# **App Name**: YABA: Yet Another Budgeting App

## Core Features:

- **Receipt Capture**: Capture receipt images via camera with automatic edge detection, cropping, perspective correction, and image enhancement.
- **Data Extraction (AI-Powered OCR)**: Employ an AI tool to extract key information from receipts: vendor name, date, time, total amount, taxes, and payment method.
- **Expense Categorization (AI-Driven)**: Automatically categorize expenses using AI, with options for users to create and edit custom categories.
- **Manual Editing**: Enable manual editing of all extracted data and categories for accuracy and customization.
- **Spending Dashboard and Reporting**: Provide a dashboard for a quick overview of spending, reports by date ranges, categories, and data export in CSV and Excel formats.

## Student-Centric Features:

- **Budget Creation & Tracking**: Set and monitor spending limits per category (e.g., monthly food budget). Get alerts when you're approaching your limit.
- **Savings Goals**: Create and track progress towards specific financial goals, like saving for a new computer or a vacation.
- **Subscription Management**: Keep an eye on all your recurring monthly or yearly charges in one place.
- **Student-Focused Insights**: The app will include default categories tailored to student life (e.g., Textbooks, Tuition, Supplies) and provide helpful financial tips.

## Style Guidelines:

- Primary color: HSL(48, 75%, 50%) - A vibrant gold (#D9A829) to evoke a sense of wealth and fiscal responsibility.
- Background color: HSL(48, 20%, 95%) - A light beige (#F5F4F0), to set off the brighter gold and to keep with the classic styling.
- Accent color: HSL(18, 75%, 45%) - A burnt orange (#D97A29), to complement the gold and highlight key interactive elements without clashing.
- Body and headline font: 'Alegreya', a serif font providing a slightly vintage yet contemporary feel appropriate to record-keeping and light data presentation
- Use clear, minimalist icons for categories and actions, ensuring ease of understanding and a professional look.
- Maintain a clean and structured layout, prioritizing readability and ease of navigation. Use white space effectively to avoid clutter.
- Incorporate subtle animations for loading states and transitions to enhance the user experience without being distracting.


# Tech Debt:

### In-Depth Spending & Behavioral Analysis

### Done
- **Time-Based Analysis**: Use heatmaps or charts to show spending patterns based on the day of the week or time of day.
- **Outlier Detection**: Automatically flag unusually large expenses in any category.
- **Budget Pacing Alerts**: Proactively warn users if they are on track to exceed their budget for the month.
- **Savings Goal Forecasting**: Project the completion date for savings goals based on the user's average savings rate.
- **Automated Monthly Reports**: Automatically generate and send a detailed summary of the user's monthly financial activity, including insights and advice.

# Future Features
- **Spending Trends Over Time**: Visualize spending per category over several months to identify trends, lifestyle inflation, or seasonal habits.
- **Vendor Deep Dive**: Analyze spending at specific merchants, including top vendors per category and visit frequency.
### Predictive Analytics & Forecasting
- **Cash Flow Forecasting**: Project future account balances based on historical income and spending.
### Advanced Budgeting & Savings Insights
- **Budget vs. Actuals Visualization**: Show a real-time chart comparing budgeted amounts to actual spending throughout the period.
- **"What-If" Scenarios**: Allow users to simulate how changes in spending could impact their savings goals.
- **Surplus Reallocation**: Suggest moving unspent money from budget categories directly into savings goals at the end of a period.
### AI-Powered Features
- **Smarter Categorization**: Use machine learning to improve automatic expense categorization based on user corrections.
- **Natural Language Queries**: Enable users to ask questions about their finances in plain English (e.g., "How much did I spend on food last week?").
