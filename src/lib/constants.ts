export const EXPENSE_CATEGORIES = [
  "Housing",
  "Transportation",
  "Food",
  "Utilities",
  "Healthcare",
  "Personal Care",
  "Entertainment",
  "Shopping",
  "Debt Payments",
  "Savings & Investments",
  "Miscellaneous",
] as const;

export const PARENT_CATEGORIES: Record<string, readonly string[]> = {
  Needs: ["Housing", "Transportation", "Food", "Utilities", "Healthcare"],
  Wants: ["Personal Care", "Entertainment", "Shopping"],
  "Financial Goals": ["Debt Payments", "Savings & Investments"],
  Other: ["Miscellaneous"],
};

export const INCOME_SOURCES = [
  "Salary",
  "Freelance",
  "Business",
  "Investments",
  "Rental Income",
  "Side Hustle",
  "Gifts",
  "Refunds",
  "Government Benefits",
  "Scholarships & Grants",
  "Other",
] as const;
