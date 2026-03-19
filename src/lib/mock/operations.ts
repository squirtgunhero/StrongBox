export type NavItem = {
  name: string;
  href: string;
  icon: string;
  badge?: string;
};

export type DashboardKpi = {
  label: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down" | "flat";
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type DistributionPoint = {
  label: string;
  value: number;
  color: string;
};

export type StagePoint = {
  stage: string;
  count: number;
  amount: number;
};

export type RiskRow = {
  label: string;
  exposure: number;
  share: number;
  riskLevel: "low" | "moderate" | "high";
};

export type ActivityItem = {
  id: string;
  type: "loan" | "payment" | "document" | "condition" | "status" | "comment";
  title: string;
  detail: string;
  actor: string;
  when: string;
};

export type AttentionLoan = {
  id: string;
  loanId: string;
  borrower: string;
  issue: string;
  severity: "low" | "medium" | "high";
  due: string;
};

export type TaskItem = {
  id: string;
  title: string;
  owner: string;
  due: string;
  priority: "low" | "medium" | "high";
};

export type LoanRecord = {
  id: string;
  loanId: string;
  borrower: string;
  borrowerEntity: string;
  property: string;
  propertyType: "SFR" | "Multifamily" | "Retail" | "Industrial" | "Mixed-Use";
  loanType: "Bridge" | "DSCR" | "Construction" | "Rental Portfolio";
  stage: "Lead" | "Application" | "Underwriting" | "Conditional" | "Approved" | "Funded" | "Active" | "Matured" | "Delinquent";
  principal: number;
  interestRate: number;
  ltv: number;
  maturityDate: string;
  paymentStatus: "Current" | "Due Soon" | "Late" | "Grace";
  lastActivity: string;
  manager: string;
  riskGrade: "A" | "B" | "C" | "D";
  docsPending: number;
  nextPaymentAmount: number;
  timeline: Array<{ date: string; event: string; by: string }>;
  notes: string;
};

export const dashboardKpis: DashboardKpi[] = [
  { label: "Total Portfolio Value", value: "$128.4M", trend: "+6.2% QoQ", trendDirection: "up" },
  { label: "Active Loans", value: "184", trend: "+11 this month", trendDirection: "up" },
  { label: "Pipeline Volume", value: "$41.9M", trend: "27 deals in queue", trendDirection: "up" },
  { label: "Capital Deployed", value: "$18.7M", trend: "vs $16.1M prior", trendDirection: "up" },
  { label: "Upcoming Payoffs", value: "$12.3M", trend: "9 within 45 days", trendDirection: "flat" },
  { label: "Delinquent Loans", value: "7", trend: "-2 from last month", trendDirection: "down" },
  { label: "Weighted Avg Rate", value: "10.84%", trend: "+24 bps", trendDirection: "up" },
  { label: "Average LTV", value: "66.1%", trend: "within policy", trendDirection: "flat" },
];

export const portfolioTrend: TrendPoint[] = [
  { label: "Apr", value: 92.3 },
  { label: "May", value: 96.8 },
  { label: "Jun", value: 101.1 },
  { label: "Jul", value: 104.7 },
  { label: "Aug", value: 108.9 },
  { label: "Sep", value: 111.4 },
  { label: "Oct", value: 115.7 },
  { label: "Nov", value: 118.6 },
  { label: "Dec", value: 121.2 },
  { label: "Jan", value: 123.5 },
  { label: "Feb", value: 126.7 },
  { label: "Mar", value: 128.4 },
];

export const statusDistribution: DistributionPoint[] = [
  { label: "Active", value: 57, color: "#2F88FF" },
  { label: "Funded", value: 18, color: "#34D399" },
  { label: "Underwriting", value: 13, color: "#F59E0B" },
  { label: "Conditional", value: 8, color: "#7C93FF" },
  { label: "Delinquent", value: 4, color: "#F97373" },
];

export const capitalFlow: TrendPoint[] = [
  { label: "Oct", value: 5.1 },
  { label: "Nov", value: 6.4 },
  { label: "Dec", value: 4.9 },
  { label: "Jan", value: 7.3 },
  { label: "Feb", value: 8.1 },
  { label: "Mar", value: 6.8 },
];

export const repaymentFlow: TrendPoint[] = [
  { label: "Oct", value: 3.4 },
  { label: "Nov", value: 4.2 },
  { label: "Dec", value: 3.8 },
  { label: "Jan", value: 4.6 },
  { label: "Feb", value: 4.9 },
  { label: "Mar", value: 5.2 },
];

export const pipelineByStage: StagePoint[] = [
  { stage: "New Submissions", count: 14, amount: 11.6 },
  { stage: "Underwriting", count: 9, amount: 14.2 },
  { stage: "Docs Pending", count: 7, amount: 9.8 },
  { stage: "Approval Committee", count: 5, amount: 6.4 },
  { stage: "Funding Ready", count: 4, amount: 5.1 },
];

export const riskRows: RiskRow[] = [
  { label: "South Florida", exposure: 31.4, share: 24.5, riskLevel: "moderate" },
  { label: "Southern California", exposure: 24.1, share: 18.8, riskLevel: "moderate" },
  { label: "New York Metro", exposure: 17.8, share: 13.9, riskLevel: "low" },
  { label: "Texas Triangle", exposure: 15.2, share: 11.8, riskLevel: "low" },
  { label: "High-LTV (>=75%)", exposure: 9.7, share: 7.6, riskLevel: "high" },
];

export const attentionLoans: AttentionLoan[] = [
  {
    id: "al-1",
    loanId: "SB-24031",
    borrower: "Bayshore Revive LLC",
    issue: "Insurance cert expired",
    severity: "high",
    due: "Today",
  },
  {
    id: "al-2",
    loanId: "SB-24044",
    borrower: "Crescent Grove Partners",
    issue: "Interest payment 8 days late",
    severity: "high",
    due: "Immediate",
  },
  {
    id: "al-3",
    loanId: "SB-24058",
    borrower: "Northline Holdings",
    issue: "Draw inspection pending",
    severity: "medium",
    due: "Tomorrow",
  },
  {
    id: "al-4",
    loanId: "SB-24062",
    borrower: "Verde Point Capital",
    issue: "Guarantor KYC follow-up",
    severity: "low",
    due: "Mar 22",
  },
];

export const tasksDueToday: TaskItem[] = [
  { id: "t-1", title: "Finalize committee memo for SB-24067", owner: "J. Nguyen", due: "2:30 PM", priority: "high" },
  { id: "t-2", title: "Borrower follow-up: rent roll update", owner: "M. Ortega", due: "3:00 PM", priority: "medium" },
  { id: "t-3", title: "Review UCC search exceptions", owner: "K. Patel", due: "4:15 PM", priority: "medium" },
  { id: "t-4", title: "Approve funding package SB-24069", owner: "A. Reynolds", due: "5:00 PM", priority: "high" },
];

export const recentActivity: ActivityItem[] = [
  {
    id: "ev-1",
    type: "payment",
    title: "Payment received",
    detail: "$182,440 from Atlas Harbor Holdings on SB-24021",
    actor: "Treasury Bot",
    when: "4 min ago",
  },
  {
    id: "ev-2",
    type: "document",
    title: "Document uploaded",
    detail: "Updated appraisal added for SB-24058",
    actor: "M. Ortega",
    when: "19 min ago",
  },
  {
    id: "ev-3",
    type: "status",
    title: "Status changed",
    detail: "SB-24072 moved to Conditional Approval",
    actor: "J. Nguyen",
    when: "42 min ago",
  },
  {
    id: "ev-4",
    type: "condition",
    title: "Condition satisfied",
    detail: "Borrower liquidity covenant verified for SB-24067",
    actor: "K. Patel",
    when: "1h ago",
  },
  {
    id: "ev-5",
    type: "comment",
    title: "Team note posted",
    detail: "Updated refinance strategy notes for Camden Retail",
    actor: "A. Reynolds",
    when: "2h ago",
  },
  {
    id: "ev-6",
    type: "loan",
    title: "New submission",
    detail: "SB-24079 submitted for review ($2.8M bridge)",
    actor: "Originations Intake",
    when: "3h ago",
  },
];

export const sampleLoans: LoanRecord[] = [
  {
    id: "loan-1",
    loanId: "SB-24079",
    borrower: "Granite Elm Partners",
    borrowerEntity: "Granite Elm Partners LLC",
    property: "1845 Maple Ave, Dallas, TX",
    propertyType: "Multifamily",
    loanType: "Bridge",
    stage: "Underwriting",
    principal: 2800000,
    interestRate: 10.75,
    ltv: 68,
    maturityDate: "2027-08-30",
    paymentStatus: "Current",
    lastActivity: "Updated trailing-12 NOI",
    manager: "Jules Nguyen",
    riskGrade: "B",
    docsPending: 3,
    nextPaymentAmount: 25144,
    timeline: [
      { date: "Mar 17", event: "Borrower packet received", by: "Intake" },
      { date: "Mar 18", event: "Credit review assigned", by: "Jules Nguyen" },
      { date: "Mar 19", event: "Sponsor call completed", by: "Jules Nguyen" },
    ],
    notes: "Strong rent growth, but lease rollover concentration in Q4 requires closer stress testing.",
  },
  {
    id: "loan-2",
    loanId: "SB-24072",
    borrower: "Harborline Revive",
    borrowerEntity: "Harborline Revive LP",
    property: "315 Biscayne Blvd, Miami, FL",
    propertyType: "Mixed-Use",
    loanType: "Construction",
    stage: "Conditional",
    principal: 4250000,
    interestRate: 11.4,
    ltv: 71,
    maturityDate: "2028-02-12",
    paymentStatus: "Due Soon",
    lastActivity: "Conditional approvals issued",
    manager: "Ari Reynolds",
    riskGrade: "C",
    docsPending: 6,
    nextPaymentAmount: 40375,
    timeline: [
      { date: "Mar 12", event: "Committee discussion", by: "Credit Committee" },
      { date: "Mar 16", event: "Budget revision requested", by: "Ari Reynolds" },
      { date: "Mar 19", event: "Conditional terms accepted", by: "Borrower Counsel" },
    ],
    notes: "Construction reserve and GMP timing are primary close blockers.",
  },
  {
    id: "loan-3",
    loanId: "SB-24067",
    borrower: "Camden Retail Holdings",
    borrowerEntity: "Camden Retail Holdings LLC",
    property: "911 S Federal Hwy, Fort Lauderdale, FL",
    propertyType: "Retail",
    loanType: "Bridge",
    stage: "Approved",
    principal: 3650000,
    interestRate: 10.15,
    ltv: 64,
    maturityDate: "2027-11-05",
    paymentStatus: "Current",
    lastActivity: "Funding package in final QC",
    manager: "Mila Ortega",
    riskGrade: "B",
    docsPending: 2,
    nextPaymentAmount: 30871,
    timeline: [
      { date: "Mar 10", event: "Legal docs circulated", by: "Closing" },
      { date: "Mar 14", event: "Title endorsement returned", by: "Title Agent" },
      { date: "Mar 19", event: "Final sign-off pending", by: "Treasury" },
    ],
    notes: "Borrower has repeat history with clean exits; watch co-tenancy clause exposure.",
  },
  {
    id: "loan-4",
    loanId: "SB-24058",
    borrower: "Northline Holdings",
    borrowerEntity: "Northline Holdings Inc.",
    property: "5522 W Adams Blvd, Los Angeles, CA",
    propertyType: "SFR",
    loanType: "Construction",
    stage: "Active",
    principal: 1975000,
    interestRate: 11.95,
    ltv: 73,
    maturityDate: "2027-03-20",
    paymentStatus: "Current",
    lastActivity: "Draw #2 inspection pending",
    manager: "Keisha Patel",
    riskGrade: "C",
    docsPending: 1,
    nextPaymentAmount: 19652,
    timeline: [
      { date: "Mar 07", event: "Draw request submitted", by: "Borrower" },
      { date: "Mar 14", event: "Site visit scheduled", by: "Field Ops" },
      { date: "Mar 19", event: "Inspection report awaiting", by: "Field Ops" },
    ],
    notes: "Permit pace has improved. Keep close cadence on contractor waivers.",
  },
  {
    id: "loan-5",
    loanId: "SB-24044",
    borrower: "Crescent Grove Partners",
    borrowerEntity: "Crescent Grove Partners LP",
    property: "2331 Grove St, Orlando, FL",
    propertyType: "Multifamily",
    loanType: "DSCR",
    stage: "Active",
    principal: 5120000,
    interestRate: 9.9,
    ltv: 69,
    maturityDate: "2026-12-19",
    paymentStatus: "Late",
    lastActivity: "Past due notice sent",
    manager: "Jules Nguyen",
    riskGrade: "D",
    docsPending: 0,
    nextPaymentAmount: 42240,
    timeline: [
      { date: "Mar 05", event: "Payment reminder sent", by: "Servicing" },
      { date: "Mar 11", event: "Borrower requested extension", by: "Servicing" },
      { date: "Mar 19", event: "Escalated to special assets", by: "Risk" },
    ],
    notes: "Cash flow pressure from insurance spike. Monitoring DSCR covenant breach risk.",
  },
  {
    id: "loan-6",
    loanId: "SB-24031",
    borrower: "Bayshore Revive LLC",
    borrowerEntity: "Bayshore Revive LLC",
    property: "77 Harbor Point Rd, Tampa, FL",
    propertyType: "Industrial",
    loanType: "Bridge",
    stage: "Active",
    principal: 4380000,
    interestRate: 10.2,
    ltv: 62,
    maturityDate: "2026-10-01",
    paymentStatus: "Grace",
    lastActivity: "Insurance cert follow-up",
    manager: "Ari Reynolds",
    riskGrade: "C",
    docsPending: 1,
    nextPaymentAmount: 37230,
    timeline: [
      { date: "Mar 09", event: "Insurance certificate expired", by: "Covenants" },
      { date: "Mar 13", event: "Broker contact initiated", by: "Ari Reynolds" },
      { date: "Mar 19", event: "Escalation reminder", by: "Covenants" },
    ],
    notes: "Strong operating cash flow, but covenant admin quality is inconsistent.",
  },
  {
    id: "loan-7",
    loanId: "SB-24021",
    borrower: "Atlas Harbor Holdings",
    borrowerEntity: "Atlas Harbor Holdings LLC",
    property: "14 Front St, Brooklyn, NY",
    propertyType: "Mixed-Use",
    loanType: "Bridge",
    stage: "Active",
    principal: 6890000,
    interestRate: 10.45,
    ltv: 61,
    maturityDate: "2027-01-15",
    paymentStatus: "Current",
    lastActivity: "Monthly payment posted",
    manager: "Mila Ortega",
    riskGrade: "A",
    docsPending: 0,
    nextPaymentAmount: 59921,
    timeline: [
      { date: "Mar 03", event: "Leasing report delivered", by: "Borrower" },
      { date: "Mar 12", event: "Rent roll validated", by: "Asset Mgmt" },
      { date: "Mar 19", event: "Payment received", by: "Treasury" },
    ],
    notes: "Top-tier sponsor with stable occupancy and multiple refinance options.",
  },
  {
    id: "loan-8",
    loanId: "SB-24018",
    borrower: "Monarch Single Asset",
    borrowerEntity: "Monarch Single Asset LLC",
    property: "498 W 9th Ave, Denver, CO",
    propertyType: "SFR",
    loanType: "DSCR",
    stage: "Funded",
    principal: 1320000,
    interestRate: 9.65,
    ltv: 67,
    maturityDate: "2028-03-01",
    paymentStatus: "Current",
    lastActivity: "Closing completed",
    manager: "Keisha Patel",
    riskGrade: "B",
    docsPending: 0,
    nextPaymentAmount: 10615,
    timeline: [
      { date: "Mar 11", event: "Final closing docs signed", by: "Closing" },
      { date: "Mar 13", event: "Wire confirmed", by: "Treasury" },
      { date: "Mar 18", event: "Boarding complete", by: "Servicing" },
    ],
    notes: "Clean close. Post-close rent verification due in April.",
  },
  {
    id: "loan-9",
    loanId: "SB-24014",
    borrower: "Pinecrest Operators",
    borrowerEntity: "Pinecrest Operators LLC",
    property: "216 Spring Blvd, Charlotte, NC",
    propertyType: "Multifamily",
    loanType: "Rental Portfolio",
    stage: "Matured",
    principal: 5720000,
    interestRate: 9.35,
    ltv: 58,
    maturityDate: "2026-04-09",
    paymentStatus: "Due Soon",
    lastActivity: "Payoff quote requested",
    manager: "Jules Nguyen",
    riskGrade: "B",
    docsPending: 1,
    nextPaymentAmount: 44672,
    timeline: [
      { date: "Mar 08", event: "Exit strategy review", by: "Asset Mgmt" },
      { date: "Mar 15", event: "Refi lender term sheet", by: "Borrower" },
      { date: "Mar 19", event: "Payoff quote generated", by: "Servicing" },
    ],
    notes: "Likely refinance exit; monitor appraisal turnaround timeline.",
  },
  {
    id: "loan-10",
    loanId: "SB-24003",
    borrower: "Westgate Redevelopment",
    borrowerEntity: "Westgate Redevelopment Partners",
    property: "620 Lincoln St, Phoenix, AZ",
    propertyType: "Retail",
    loanType: "Construction",
    stage: "Delinquent",
    principal: 4840000,
    interestRate: 12.1,
    ltv: 76,
    maturityDate: "2026-07-21",
    paymentStatus: "Late",
    lastActivity: "Workout call scheduled",
    manager: "Ari Reynolds",
    riskGrade: "D",
    docsPending: 4,
    nextPaymentAmount: 48803,
    timeline: [
      { date: "Mar 01", event: "Payment missed", by: "Servicing" },
      { date: "Mar 10", event: "Default notice drafted", by: "Legal" },
      { date: "Mar 19", event: "Workout call booked", by: "Special Assets" },
    ],
    notes: "Elevated distress. Consider capex holdback controls and sponsor support letter.",
  },
  {
    id: "loan-11",
    loanId: "SB-23998",
    borrower: "Silverline Industrial",
    borrowerEntity: "Silverline Industrial Fund I",
    property: "1201 Commerce Dr, Atlanta, GA",
    propertyType: "Industrial",
    loanType: "Bridge",
    stage: "Active",
    principal: 7410000,
    interestRate: 10.05,
    ltv: 63,
    maturityDate: "2027-05-04",
    paymentStatus: "Current",
    lastActivity: "Environmental report cleared",
    manager: "Mila Ortega",
    riskGrade: "A",
    docsPending: 0,
    nextPaymentAmount: 62034,
    timeline: [
      { date: "Mar 04", event: "Quarterly reporting received", by: "Asset Mgmt" },
      { date: "Mar 12", event: "NOI beat plan by 6%", by: "Asset Mgmt" },
      { date: "Mar 18", event: "Environmental clean", by: "3rd Party" },
    ],
    notes: "Solid sponsor, low risk. Candidate for relationship expansion.",
  },
  {
    id: "loan-12",
    loanId: "SB-23987",
    borrower: "Verde Point Capital",
    borrowerEntity: "Verde Point Capital LLC",
    property: "402 Mission St, San Francisco, CA",
    propertyType: "Mixed-Use",
    loanType: "Bridge",
    stage: "Application",
    principal: 3180000,
    interestRate: 10.9,
    ltv: 65,
    maturityDate: "2027-12-11",
    paymentStatus: "Current",
    lastActivity: "KYC package requested",
    manager: "Keisha Patel",
    riskGrade: "B",
    docsPending: 5,
    nextPaymentAmount: 28885,
    timeline: [
      { date: "Mar 15", event: "Application started", by: "Originations" },
      { date: "Mar 17", event: "Initial sizing completed", by: "Credit" },
      { date: "Mar 19", event: "KYC follow-up", by: "Compliance" },
    ],
    notes: "Experienced operator; leverage remains within guardrails.",
  },
  {
    id: "loan-13",
    loanId: "SB-23973",
    borrower: "Lakeview Homes Group",
    borrowerEntity: "Lakeview Homes Group LLC",
    property: "88 Main St, Nashville, TN",
    propertyType: "SFR",
    loanType: "DSCR",
    stage: "Funded",
    principal: 1190000,
    interestRate: 9.45,
    ltv: 70,
    maturityDate: "2028-01-08",
    paymentStatus: "Current",
    lastActivity: "Boarded to servicing",
    manager: "Jules Nguyen",
    riskGrade: "B",
    docsPending: 0,
    nextPaymentAmount: 9376,
    timeline: [
      { date: "Mar 11", event: "Loan closed", by: "Closing" },
      { date: "Mar 13", event: "Escrow funded", by: "Treasury" },
      { date: "Mar 18", event: "Payment draft set", by: "Servicing" },
    ],
    notes: "Straightforward profile with strong rent-to-payment coverage.",
  },
  {
    id: "loan-14",
    loanId: "SB-23961",
    borrower: "Beacon Yard Ventures",
    borrowerEntity: "Beacon Yard Ventures LLC",
    property: "700 River Rd, Jersey City, NJ",
    propertyType: "Multifamily",
    loanType: "Bridge",
    stage: "Lead",
    principal: 6100000,
    interestRate: 10.7,
    ltv: 67,
    maturityDate: "2028-05-29",
    paymentStatus: "Current",
    lastActivity: "Referral intake created",
    manager: "Ari Reynolds",
    riskGrade: "C",
    docsPending: 8,
    nextPaymentAmount: 54342,
    timeline: [
      { date: "Mar 16", event: "Lead created", by: "Originations" },
      { date: "Mar 18", event: "Intro call complete", by: "Ari Reynolds" },
      { date: "Mar 19", event: "Requested rent roll", by: "Originations" },
    ],
    notes: "Early-stage lead with moderate leverage and sponsor new to platform.",
  },
];

export const managers = ["Jules Nguyen", "Ari Reynolds", "Mila Ortega", "Keisha Patel"];

export const savedLoanViews = [
  "All Loans",
  "Today: Priority Follow-up",
  "Delinquency Watchlist",
  "Funding This Week",
  "Maturing in 60 Days",
  "High LTV (>= 72%)",
];
