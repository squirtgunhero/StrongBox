import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

type KnownTotals = {
  activeExposureTotal: number;
  activeLoanCount: number;
  upcomingFundingNeed: number;
  pendingDrawRequests: number;
  closedProjects2024Count: number;
};

async function ensureStrongboxBorrower(input: {
  legal_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source?: string;
  home_state?: string;
}) {
  const existing = await prisma.sbBorrower.findFirst({
    where: {
      OR: [
        { legal_name: input.legal_name },
        ...(input.email ? [{ email: input.email }] : []),
      ],
    },
  });

  if (existing) {
    return prisma.sbBorrower.update({
      where: { id: existing.id },
      data: {
        contact_name: input.contact_name ?? existing.contact_name,
        email: input.email ?? existing.email,
        phone: input.phone ?? existing.phone,
        source: input.source ?? existing.source,
        home_state: input.home_state ?? existing.home_state,
      },
    });
  }

  return prisma.sbBorrower.create({
    data: {
      legal_name: input.legal_name,
      contact_name: input.contact_name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      home_state: input.home_state,
    },
  });
}

async function main() {
  console.log("Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "strong-investor-loans" },
    update: {},
    create: {
      name: "Strong Investor Loans",
      slug: "strong-investor-loans",
      settings: {
        defaultInterestRate: 12.0,
        defaultTermMonths: 12,
        defaultOriginationFee: 2.0,
        dayCountConvention: "actual/360",
        lateFeeGraceDays: 10,
        lateFeePercent: 5.0,
        defaultDaysDelinquent: 90,
      },
    },
  });

  console.log(`Created organization: ${org.name} (${org.id})`);

  const borrowers = await Promise.all([
    ensureStrongboxBorrower({
      legal_name: "Atlas Build LLC",
      contact_name: "Avery Stone",
      email: "ops@atlasbuild.com",
      phone: "402-555-0101",
      source: "Client List",
      home_state: "NE",
    }),
    ensureStrongboxBorrower({
      legal_name: "Northline Development",
      contact_name: "Jordan Fields",
      email: "team@northline.dev",
      phone: "913-555-0192",
      source: "Clients",
      home_state: "KS",
    }),
  ]);

  const marketOmaha = await prisma.sbMarketReference.upsert({
    where: { market_name_state: { market_name: "Omaha", state: "NE" } },
    update: {},
    create: {
      market_name: "Omaha",
      state: "NE",
      is_active: true,
    },
  });

  const propertyA = await prisma.sbProperty.upsert({
    where: { id: "sb_property_001" },
    update: {},
    create: {
      id: "sb_property_001",
      borrower_id: borrowers[0].id,
      full_address: "123 Maple St, Omaha, NE 68102",
      city: "Omaha",
      state: "NE",
      zip: "68102",
      market_name: marketOmaha.market_name,
      is_active: true,
    },
  });

  const propertyB = await prisma.sbProperty.upsert({
    where: { id: "sb_property_002" },
    update: {},
    create: {
      id: "sb_property_002",
      borrower_id: borrowers[1].id,
      full_address: "4500 Grand Ave, Kansas City, MO 64111",
      city: "Kansas City",
      state: "MO",
      zip: "64111",
      market_name: "Unmapped",
      is_active: true,
    },
  });

  const activeLoanA = await prisma.sbLoan.upsert({
    where: {
      source_sheet_source_row_key: {
        source_sheet: "Cash Out",
        source_row_key: "cash_out:10",
      },
    },
    update: {},
    create: {
      borrower_id: borrowers[0].id,
      property_id: propertyA.id,
      loan_stage: "ACTIVE",
      loan_status: "ACTIVE",
      loan_type: "fix_and_flip",
      origination_date: new Date("2025-12-15"),
      maturity_date: new Date("2026-06-15"),
      term_months: 12,
      terms_text: "12 months IO",
      principal_total: 500000,
      purchase_amount: 380000,
      rehab_amount: 120000,
      draw_reserve: 100000,
      arv: 710000,
      ltv: 0.704225,
      rehab_percent_of_loan: 0.24,
      interest_rate: 11.25,
      origination_fee: 10000,
      monthly_payment: 4688,
      title_company: "Heartland Title",
      title_contact: "Alex Harper",
      source_sheet: "Cash Out",
      source_row_key: "cash_out:10",
    },
  });

  await prisma.sbLoan.upsert({
    where: {
      source_sheet_source_row_key: {
        source_sheet: "Exposure",
        source_row_key: "exposure:22",
      },
    },
    update: {},
    create: {
      borrower_id: borrowers[1].id,
      property_id: propertyB.id,
      loan_stage: "ACTIVE",
      loan_status: "FUNDED",
      loan_type: "bridge",
      origination_date: new Date("2026-01-05"),
      maturity_date: new Date("2026-04-10"),
      term_months: 9,
      terms_text: "Bridge short term",
      principal_total: 325000,
      purchase_amount: 250000,
      rehab_amount: 75000,
      draw_reserve: 65000,
      arv: 470000,
      ltv: 0.691489,
      rehab_percent_of_loan: 0.230769,
      interest_rate: 12.5,
      monthly_payment: 3385,
      source_sheet: "Exposure",
      source_row_key: "exposure:22",
    },
  });

  await prisma.sbLoan.upsert({
    where: {
      source_sheet_source_row_key: {
        source_sheet: "Upcoming Loans",
        source_row_key: "upcoming:7",
      },
    },
    update: {},
    create: {
      borrower_id: borrowers[0].id,
      property_id: propertyA.id,
      loan_stage: "UPCOMING",
      loan_status: "APPROVED",
      loan_type: "purchase_plus_rehab",
      origination_date: new Date("2026-03-25"),
      maturity_date: new Date("2027-03-25"),
      term_months: 12,
      principal_total: 410000,
      purchase_amount: 300000,
      rehab_amount: 110000,
      draw_reserve: 90000,
      arv: 610000,
      ltv: 0.672131,
      rehab_percent_of_loan: 0.268293,
      title_company: "Pioneer Title",
      total_cash_currently_needed: 83500,
      source_sheet: "Upcoming Loans",
      source_row_key: "upcoming:7",
    },
  });

  const closedLoan = await prisma.sbLoan.upsert({
    where: {
      source_sheet_source_row_key: {
        source_sheet: "Closed Projects 2024",
        source_row_key: "closed2024:31",
      },
    },
    update: {},
    create: {
      borrower_id: borrowers[0].id,
      property_id: propertyA.id,
      loan_stage: "CLOSED",
      loan_status: "PAID_OFF",
      loan_type: "fix_and_flip",
      origination_date: new Date("2023-08-10"),
      payoff_date: new Date("2024-04-12"),
      maturity_date: new Date("2024-08-10"),
      term_months: 12,
      principal_total: 285000,
      purchase_amount: 220000,
      rehab_amount: 65000,
      terms_text: "12 month rehab",
      source_sheet: "Closed Projects 2024",
      source_row_key: "closed2024:31",
    },
  });

  const draw = await prisma.sbDrawRequest.create({
    data: {
      loan_id: activeLoanA.id,
      property_id: propertyA.id,
      request_date: new Date("2026-03-10"),
      amount_requested: 30000,
      payment_method: "wire",
      status: "REQUESTED",
      notes: "Framing phase completion",
    },
  });

  await prisma.sbDrawRequestAudit.create({
    data: {
      draw_request_id: draw.id,
      action_type: "requested",
      requested_amount: 30000,
      notes: "Seeded from Draw Requests sheet",
    },
  });

  await prisma.sbCashAccount.upsert({
    where: { account_name: "Operating Cash" },
    update: { current_balance: 265000 },
    create: {
      account_name: "Operating Cash",
      current_balance: 265000,
      notes: "Available Cash sheet",
    },
  });

  await prisma.sbPortfolioSnapshot.create({
    data: {
      snapshot_date: new Date("2026-03-19"),
      total_loans_out: 825000,
      company_cash_out: 460000,
      current_cash_balance: 265000,
      total_company_cash: 725000,
      total_draw_reserve: 165000,
      upcoming_hml_loans: 1,
      loc_business_balance: 85000,
    },
  });

  await prisma.sbAnnualLoanHistory.upsert({
    where: { id: "history_2024_01" },
    update: {},
    create: {
      id: "history_2024_01",
      loan_id: closedLoan.id,
      closed_year: 2024,
      borrower_name: borrowers[0].legal_name,
      origination_date: new Date("2023-08-10"),
      payoff_date: new Date("2024-04-12"),
      years_outstanding: 0.67,
      principal: 285000,
      purchase_amount: 220000,
      rehab_amount: 65000,
      city: "Omaha",
      state: "NE",
      loan_type: "fix_and_flip",
      terms_text: "12 month rehab",
      property_address: propertyA.full_address,
    },
  });

  await prisma.sbTax1098Prep.upsert({
    where: { id: "tax_1098_seed_1" },
    update: {},
    create: {
      id: "tax_1098_seed_1",
      borrower_id: borrowers[0].id,
      borrower_name: borrowers[0].legal_name,
      loans_closed_2022_count: 0,
      loans_closed_2023_count: 0,
      active_or_cashout_count: 2,
      total_loan_count: 3,
      terms_reference: "12 month rehab",
      property_address: propertyA.full_address,
      source_reference: "1098 Prep Sheet row 12",
      review_flag: false,
    },
  });

  const totalsPath = join(process.cwd(), "prisma", "workbook-data", "knownTotals.json");
  let knownTotals: KnownTotals = {
    activeExposureTotal: 825000,
    activeLoanCount: 2,
    upcomingFundingNeed: 83500,
    pendingDrawRequests: 1,
    closedProjects2024Count: 1,
  };

  if (existsSync(totalsPath)) {
    knownTotals = JSON.parse(readFileSync(totalsPath, "utf-8")) as KnownTotals;
  }

  const activeAgg = await prisma.sbLoan.aggregate({
    where: {
      loan_stage: "ACTIVE",
      loan_status: { in: ["ACTIVE", "FUNDED"] },
    },
    _count: true,
    _sum: { principal_total: true },
  });

  const upcomingAgg = await prisma.sbLoan.aggregate({
    where: { loan_stage: "UPCOMING" },
    _sum: { total_cash_currently_needed: true },
  });

  const pendingDrawCount = await prisma.sbDrawRequest.count({
    where: { status: { in: ["REQUESTED", "UNDER_REVIEW"] } },
  });

  const closed2024Count = await prisma.sbAnnualLoanHistory.count({
    where: { closed_year: 2024 },
  });

  const computed = {
    activeExposureTotal: Number(activeAgg._sum.principal_total || 0),
    activeLoanCount: activeAgg._count,
    upcomingFundingNeed: Number(upcomingAgg._sum.total_cash_currently_needed || 0),
    pendingDrawRequests: pendingDrawCount,
    closedProjects2024Count: closed2024Count,
  };

  console.log("StrongBox workbook validation", {
    knownTotals,
    computed,
    pass:
      computed.activeExposureTotal === knownTotals.activeExposureTotal &&
      computed.activeLoanCount === knownTotals.activeLoanCount &&
      computed.upcomingFundingNeed === knownTotals.upcomingFundingNeed &&
      computed.pendingDrawRequests === knownTotals.pendingDrawRequests &&
      computed.closedProjects2024Count === knownTotals.closedProjects2024Count,
  });

  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
