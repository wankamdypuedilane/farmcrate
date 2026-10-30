import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliveryCutoff } from "../../src/lib/deliveries/schedule";
import { asAnon, asService, asUser, connect, createUser } from "./helpers";

let db: Client;
let coop: string;
let otherCoop: string;
let small: string; // plan "Small box", 1800 cents
let family: string;
let huelgoat: string; // pickup point
let sizun: string;
let otherPlan: string; // a plan of the other co-op
let otherPickup: string;
let anna: string; // customer
let yann: string; // customer
let lena: string; // staff of Monts d'Arrée
let paul: string; // staff of the other co-op

const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];

// A Friday at least two weeks ahead (changes still open) and a past Friday (closed).
let openFriday: string;
let pastFriday: string;

async function subscribe(customer: string, plan = small, pickup = huelgoat, status = "active") {
  const { id } = await one("select public.open_subscription($1, $2, $3, $4) as id", [customer, coop, plan, pickup]);
  if (status !== "incomplete") {
    await db.query("update public.subscriptions set status = $2, activated_at = now() - interval '30 days' where id = $1", [
      id, status,
    ]);
  }
  return id as string;
}

beforeAll(async () => {
  db = await connect();
  ({ id: coop } = await one("select id from public.coops where slug = 'monts-darree'"));
  ({ id: otherCoop } = await one(
    "insert into public.coops (slug, name, delivery_weekday, is_public) values ('test-other', 'Other Co-op', 3, true) returning id",
  ));
  ({ id: small } = await one("select id from public.box_plans where name = 'Small box'"));
  ({ id: family } = await one("select id from public.box_plans where name = 'Family box'"));
  ({ id: huelgoat } = await one("select id from public.pickup_points where name like 'Huelgoat%'"));
  ({ id: sizun } = await one("select id from public.pickup_points where name like 'Sizun%'"));
  ({ id: otherPlan } = await one(
    "insert into public.box_plans (coop_id, name, weekly_price_cents) values ($1, 'Other box', 1000) returning id",
    [otherCoop],
  ));
  ({ id: otherPickup } = await one(
    "insert into public.pickup_points (coop_id, name) values ($1, 'Other point') returning id",
    [otherCoop],
  ));
  anna = await createUser(db, "anna.fc@example.com", { full_name: "Anna Le Goff" });
  yann = await createUser(db, "yann.fc@example.com", { full_name: "Yann Morvan" });
  lena = await createUser(db, "lena.fc@example.com", { full_name: "Léna Quéré" });
  paul = await createUser(db, "paul.fc@example.com", { full_name: "Paul Other" });
  await db.query("insert into public.coop_members (coop_id, user_id, role) values ($1, $2, 'staff'), ($3, $4, 'owner')", [
    coop, lena, otherCoop, paul,
  ]);
  ({ day: openFriday } = await one(
    "select (d + ((5 - extract(isodow from d)::int + 7) % 7))::text as day from (select current_date + 14 as d) x",
  ));
  ({ day: pastFriday } = await one(
    "select (d - ((extract(isodow from d)::int - 5 + 7) % 7))::text as day from (select current_date - 7 as d) x",
  ));
});

afterAll(async () => {
  await db.query("delete from public.subscriptions where customer_id = any($1)", [[anna, yann, lena, paul]]);
  await db.query("delete from public.coops where id = $1", [otherCoop]);
  await db.end();
});

describe("the public catalogue", () => {
  it("shows a public co-op's plans and pickup points to visitors, and nothing private", async () => {
    await asAnon(db, async () => {
      const { rows } = await db.query("select name from public.box_plans where coop_id = $1 order by name", [coop]);
      expect(rows.map((r) => r.name)).toEqual(["Family box", "Small box"]);
      expect((await db.query("select * from public.subscriptions")).rows).toEqual([]);
      await expect(db.query("select * from public.stripe_events")).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("hides co-ops that are not public", async () => {
    await db.query("update public.coops set is_public = false where id = $1", [otherCoop]);
    try {
      await asAnon(db, async () => {
        expect((await db.query("select * from public.box_plans where coop_id = $1", [otherCoop])).rows).toEqual([]);
      });
    } finally {
      await db.query("update public.coops set is_public = true where id = $1", [otherCoop]);
    }
  });
});

describe("opening a subscription", () => {
  it("reuses an abandoned checkout and refuses a second open subscription", async () => {
    await asService(db, async () => {
      const first = await subscribe(anna, small, huelgoat, "incomplete");
      expect(await subscribe(anna, family, sizun, "incomplete")).toBe(first);
      expect(await one("select plan_id, pickup_point_id from public.subscriptions where id = $1", [first])).toEqual({
        plan_id: family,
        pickup_point_id: sizun,
      });
      await db.query("update public.subscriptions set status = 'active' where id = $1", [first]);
      await expect(subscribe(anna)).rejects.toMatchObject({ code: "23505" });
    });
  });

  it("refuses a plan or pickup point of another co-op", async () => {
    await asService(db, async () => {
      await expect(subscribe(yann, otherPlan)).rejects.toMatchObject({ code: "P0002" });
    });
    await asService(db, async () => {
      await expect(subscribe(yann, small, otherPickup)).rejects.toMatchObject({ code: "P0002" });
    });
  });

  it("is reserved to server code", async () => {
    const { rows } = await db.query(
      `select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as users
         from pg_proc p where p.pronamespace = 'public'::regnamespace
          and p.proname in ('open_subscription', 'activate_subscription', 'sync_subscription', 'record_skip_credit')`,
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.users === false)).toBe(true);
  });
});

describe("Stripe events", () => {
  it("activate once, and never let an older event overwrite a newer state", async () => {
    await asService(db, async () => {
      const id = await subscribe(yann, small, huelgoat, "incomplete");
      await db.query("update public.subscriptions set checkout_session_id = 'cs_test_y' where id = $1", [id]);
      const activate = () =>
        one("select public.activate_subscription($1, 'cs_test_y', 'sub_test_y', '2026-12-01T10:00:00Z') as r", [id]).then((r) => r.r);
      expect(await activate()).toBe("activated");
      expect(await activate()).toBe("already_linked");
      expect((await one("select activated_at from public.subscriptions where id = $1", [id])).activated_at).toEqual(
        new Date("2026-12-01T10:00:00Z"),
      );

      const sync = (status: string, at: string) =>
        one("select public.sync_subscription('sub_test_y', $1, null, $2) as r", [status, at]).then((r) => r.r);
      expect(await sync("past_due", "2026-12-08T10:00:00Z")).toBe("updated");
      expect(await sync("active", "2026-12-05T10:00:00Z")).toBe("stale"); // delivered late
      expect((await one("select status from public.subscriptions where id = $1", [id])).status).toBe("past_due");
      expect(await sync("active", "2026-12-08T10:05:00Z")).toBe("updated");
      expect(await one("select public.sync_subscription('sub_unknown', 'active', null, now()) as r")).toEqual({ r: "unknown" });
    });
  });
});

describe("skipping a week", () => {
  it("is open to the customer until the cut-off, credits the plan's price, and is final", async () => {
    const id = await subscribe(yann, family, sizun);
    try {
      await asUser(db, yann, async () => {
        await db.query("insert into public.skips (subscription_id, delivery_date) values ($1, $2)", [id, openFriday]);
        const skip = await one("select credit_cents from public.skips where subscription_id = $1", [id]);
        expect(skip.credit_cents).toBe(2900);
        await expect(db.query("delete from public.skips where subscription_id = $1", [id])).rejects.toMatchObject({ code: "42501" });
      });
    } finally {
      await db.query("delete from public.subscriptions where id = $1", [id]);
    }
  });

  it("is refused after the cut-off, on other days, beyond eight weeks, and for someone else", async () => {
    const id = await subscribe(yann, family, sizun);
    try {
      const attempt = (user: string, day: string) =>
        asUser(db, user, () => db.query("insert into public.skips (subscription_id, delivery_date) values ($1, $2)", [id, day]));
      await expect(attempt(yann, pastFriday)).rejects.toMatchObject({ code: "42501" });
      const { day: saturday } = await one("select ($1::date + 1)::text as day", [openFriday]);
      await expect(attempt(yann, saturday)).rejects.toMatchObject({ code: "42501" });
      const { day: farFriday } = await one("select ($1::date + 63)::text as day", [openFriday]);
      await expect(attempt(yann, farFriday)).rejects.toMatchObject({ code: "42501" });
      await expect(attempt(anna, openFriday)).rejects.toMatchObject({ code: "42501" });
    } finally {
      await db.query("delete from public.subscriptions where id = $1", [id]);
    }
  });

  it("does not let the browser choose the credit", async () => {
    const id = await subscribe(yann, family, sizun);
    try {
      await asUser(db, yann, async () => {
        await expect(
          db.query("insert into public.skips (subscription_id, delivery_date, credit_cents) values ($1, $2, 999999)", [id, openFriday]),
        ).rejects.toMatchObject({ code: "42501" });
      });
    } finally {
      await db.query("delete from public.subscriptions where id = $1", [id]);
    }
  });

  it("closes at the same instant in SQL and in TypeScript, across a change of time", async () => {
    for (const day of ["2026-12-04", "2027-04-02", "2027-10-29"]) {
      const { cutoff } = await one("select private.delivery_cutoff($1, $2) as cutoff", [coop, day]);
      const ts = deliveryCutoff({ timeZone: "Europe/Paris", deliveryWeekday: 5, cutoffDays: 2, cutoffTime: "18:00" }, day);
      expect((cutoff as Date).toISOString(), day).toBe(ts.toISOString());
    }
  });
});

describe("missing skip credits", () => {
  it("are listed for server code until recorded, and only for customers known to Stripe", async () => {
    const id = await subscribe(yann, family, sizun);
    const { day: nextFriday } = await one("select ($1::date + 7)::text as day", [openFriday]);
    const pending = () =>
      asService(db, async () => {
        await db.query("select public.record_skip_credit($1, $2, 'cbtxn_Test1')", [id, openFriday]);
        const { rows } = await db.query(
          "select delivery_date::text as day, credit_cents, stripe_customer_id from public.pending_skip_credits(50) where subscription_id = $1",
          [id],
        );
        return rows;
      });
    try {
      await db.query("insert into public.skips (subscription_id, delivery_date) values ($1, $2), ($1, $3)", [
        id, openFriday, nextFriday,
      ]);
      expect(await pending()).toEqual([]); // Yann has no Stripe customer yet

      await db.query("update public.profiles set stripe_customer_id = 'cus_TestYann' where id = $1", [yann]);
      // The first skip's credit is recorded; only the second one is still waiting.
      expect(await pending()).toEqual([{ day: nextFriday, credit_cents: 2900, stripe_customer_id: "cus_TestYann" }]);

      await asUser(db, yann, async () => {
        await expect(db.query("select * from public.pending_skip_credits(50)")).rejects.toMatchObject({ code: "42501" });
      });
    } finally {
      await db.query("delete from public.subscriptions where id = $1", [id]);
      await db.query("update public.profiles set stripe_customer_id = null where id = $1", [yann]);
    }
  });
});

describe("the packing list", () => {
  it("counts active subscriptions minus skips, for the co-op's staff only", async () => {
    const a = await subscribe(anna, small, huelgoat);
    const y = await subscribe(yann, family, huelgoat);
    await db.query("insert into public.skips (subscription_id, delivery_date) values ($1, $2)", [y, openFriday]);
    try {
      const list = (user: string, day: string) =>
        asUser(db, user, () => db.query("select * from public.packing_list($1, $2)", [coop, day]).then((r) => r.rows));
      expect(await list(lena, openFriday)).toEqual([{ pickup_point: "Huelgoat covered market", plan: "Small box", boxes: 1 }]);
      const nextWeek = (await one("select ($1::date + 7)::text as day", [openFriday])).day;
      expect(await list(lena, nextWeek)).toHaveLength(2);
      expect(await list(paul, openFriday)).toEqual([]); // staff of another co-op
      expect(await list(anna, openFriday)).toEqual([]); // a customer
    } finally {
      await db.query("delete from public.subscriptions where id = any($1)", [[a, y]]);
    }
  });

  it("counts a new subscriber from the first delivery after the payment", async () => {
    const a = await subscribe(anna, small, huelgoat);
    try {
      // Paid one minute after the cut-off of openFriday: the first box is the week after.
      await db.query(
        "update public.subscriptions set activated_at = private.delivery_cutoff($2, $3) + interval '1 minute' where id = $1",
        [a, coop, openFriday],
      );
      const list = (day: string) =>
        asUser(db, lena, () => db.query("select * from public.packing_list($1, $2)", [coop, day]).then((r) => r.rows));
      expect(await list(openFriday)).toEqual([]);
      const nextWeek = (await one("select ($1::date + 7)::text as day", [openFriday])).day;
      expect(await list(nextWeek)).toEqual([{ pickup_point: "Huelgoat covered market", plan: "Small box", boxes: 1 }]);
    } finally {
      await db.query("delete from public.subscriptions where id = $1", [a]);
    }
  });

  it("lets staff read their co-op's subscriptions, not another co-op's", async () => {
    const a = await subscribe(anna);
    try {
      await asUser(db, lena, async () => {
        expect((await db.query("select id from public.subscriptions where id = $1", [a])).rows).toHaveLength(1);
      });
      await asUser(db, paul, async () => {
        expect((await db.query("select id from public.subscriptions where id = $1", [a])).rows).toHaveLength(0);
      });
    } finally {
      await db.query("delete from public.subscriptions where id = $1", [a]);
    }
  });
});
