import { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from "recharts";
import "./Dashboard.css";

import API_URL from "../api";

function getLocalMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
}

function getWeekNumber(date) {
    return Math.floor((date.getDate() - 1) / 7);
}

// const weekLabels = [
//     "Week 1 (1–7)",
//     "Week 2 (8–14)",
//     "Week 3 (15–21)",
//     "Week 4 (22–28)",
//     "Week 5 (29–end)"
// ];

function Dashboard() {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(getLocalMonth());
    const [selectedWeek, setSelectedWeek] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            setLoading(true);
            setError("");

            try {
                const [transactionResponse, productResponse] =
                    await Promise.all([
                        fetch(`${API_URL}/transactions`),
                        fetch(`${API_URL}/products`)
                    ]);

                if (!transactionResponse.ok || !productResponse.ok) {
                    throw new Error("Failed to load dashboard data.");
                }

                const [transactionData, productData] =
                    await Promise.all([
                        transactionResponse.json(),
                        productResponse.json()
                    ]);

                if (!cancelled) {
                    setTransactions(transactionData);
                    setProducts(productData);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        "Unable to load reports. Check that the backend is running."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, []);

    const monthTransactions = useMemo(() => {
        const [year, month] = selectedMonth.split("-").map(Number);

        return transactions.filter((transaction) => {
            const date = new Date(transaction.createdAt);

            return (
                !Number.isNaN(date.getTime()) &&
                date.getFullYear() === year &&
                date.getMonth() === month - 1
            );
        });
    }, [transactions, selectedMonth]);

    const weeklySales = useMemo(() => {
        const [year, month] = selectedMonth.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const numberOfWeeks = Math.ceil(daysInMonth / 7);

        return Array.from({ length: numberOfWeeks }, (_, index) => {
            const startDay = index * 7 + 1;
            const endDay = Math.min(startDay + 6, daysInMonth);

            const sales = monthTransactions
                .filter((transaction) => {
                    const day = new Date(
                        transaction.createdAt
                    ).getDate();

                    return day >= startDay && day <= endDay;
                })
                .reduce(
                    (sum, transaction) =>
                        sum + Number(transaction.total || 0),
                    0
                );

            return {
                week: `Week ${index + 1}`,
                period: `${startDay}–${endDay}`,
                sales: Number(sales.toFixed(2))
            };
        });
    }, [monthTransactions, selectedMonth]);

    const weeklyProducts = useMemo(() => {
        const totals = {};

        monthTransactions.forEach((transaction) => {
            const date = new Date(transaction.createdAt);

            if (getWeekNumber(date) !== selectedWeek) {
                return;
            }

            (transaction.items || []).forEach((item) => {
                const name = item.name || "Unknown product";
                const quantity = Number(item.quantity) || 1;

                totals[name] = (totals[name] || 0) + quantity;
            });
        });

        return Object.entries(totals)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity);
    }, [monthTransactions, selectedWeek]);

    const totalSales = monthTransactions.reduce(
        (sum, transaction) =>
            sum + Number(transaction.total || 0),
        0
    );

    const transactionCount = monthTransactions.length;

    const monthName = new Date(
        `${selectedMonth}-15T12:00:00`
    ).toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric"
    });

    const currency = (value) =>
        `₱${Number(value).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <h1>Sales Dashboard</h1>
                    <p>Sales performance and product reports</p>
                </div>

                <div className="month-filter">
                    <label htmlFor="report-month">
                        Select Month
                    </label>

                    <input
                        id="report-month"
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            setSelectedWeek(0);
                        }}
                    />
                </div>
            </div>

            {error && (
                <p className="dashboard-error">{error}</p>
            )}

            {loading ? (
                <p>Loading sales reports...</p>
            ) : (
                <>
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <h2>{currency(totalSales)}</h2>
                            <p>Total Sales — {monthName}</p>
                        </div>

                        <div className="dashboard-card">
                            <h2>{transactionCount}</h2>
                            <p>Transactions — {monthName}</p>
                        </div>

                        <div className="dashboard-card">
                            <h2>{products.length}</h2>
                            <p>Products in Catalog</p>
                        </div>
                    </div>

                    <section className="report-section">
                        <h2>Weekly Sales Report</h2>
                        <p className="report-description">
                            Total completed sales for each week of{" "}
                            {monthName}.
                        </p>

                        <div className="chart-container">
                            <ResponsiveContainer
                                width="100%"
                                height="100%"
                            >
                                <LineChart data={weeklySales}>
                                    <CartesianGrid strokeDasharray="3 3" />

                                    <XAxis
                                        dataKey="week"
                                        tick={{ fontSize: 12 }}
                                    />

                                    <YAxis
                                        tickFormatter={(value) =>
                                            `₱${value}`
                                        }
                                    />

                                    <Tooltip
                                        formatter={(value) => [
                                            currency(value),
                                            "Total Sales"
                                        ]}
                                        labelFormatter={(label) => {
                                            const item = weeklySales.find(
                                                (week) => week.week === label
                                            );

                                            return item
                                                ? `${label} (days ${item.period})`
                                                : label;
                                        }}
                                    />

                                    <Legend />

                                    <Line
                                        type="monotone"
                                        dataKey="sales"
                                        name="Total Sales"
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        dot={{ r: 5 }}
                                        activeDot={{ r: 7 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    <section className="report-section">
                        <div className="report-heading">
                            <div>
                                <h2>Best-Selling Products</h2>
                                <p className="report-description">
                                    Products ranked by quantity sold.
                                </p>
                            </div>

                            <div className="week-filter">
                                <label htmlFor="report-week">
                                    Select Week
                                </label>

                                <select
                                    id="report-week"
                                    value={selectedWeek}
                                    onChange={(e) =>
                                        setSelectedWeek(
                                            Number(e.target.value)
                                        )
                                    }
                                >
                                    {weeklySales.map((week, index) => (
                                        <option
                                            key={week.week}
                                            value={index}
                                        >
                                            {week.week} ({week.period})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {weeklyProducts.length === 0 ? (
                            <p className="empty-report">
                                No product sales found for this week.
                            </p>
                        ) : (
                            <div className="chart-container">
                                <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                >
                                    <BarChart
                                        data={weeklyProducts}
                                        margin={{
                                            top: 10,
                                            right: 20,
                                            left: 0,
                                            bottom: 45
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />

                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            angle={-30}
                                            textAnchor="end"
                                            height={65}
                                            tick={{ fontSize: 11 }}
                                        />

                                        <YAxis
                                            allowDecimals={false}
                                        />

                                        <Tooltip />

                                        <Legend />

                                        <Bar
                                            dataKey="quantity"
                                            name="Quantity Sold"
                                            fill="#16a34a"
                                            radius={[5, 5, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

export default Dashboard;