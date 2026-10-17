import { useEffect, useState } from "react";
import "./Transactions.css";
import API_URL from "../api";

function Transactions() {
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/api/transactions`)
            .then((response) => response.json())
            .then((data) => setTransactions(data))
            .catch((error) => console.error(error));
    }, []);

    return (
        <div className="transactions-page">
            <h1>Transaction History</h1>

            {transactions.length === 0 ? (
                <p>No transactions found.</p>
            ) : (
                transactions.map((transaction) => (
                    <div
                        className="transaction-card"
                        key={transaction._id}
                    >
                        <h3>
                            {transaction.transactionNumber}
                        </h3>

                        <p>
                            <strong>Cashier:</strong>{" "}
                            {transaction.cashier}
                        </p>

                        <p>
                            <strong>Total:</strong>{" "}
                            ₱{Number(transaction.total).toFixed(2)}
                        </p>

                        <p>
                            <strong>Payment:</strong>{" "}
                            {transaction.paymentMethod}
                        </p>

                        <p>
                            <strong>Amount Paid:</strong>{" "}
                            ₱{Number(
                                transaction.amountPaid
                            ).toFixed(2)}
                        </p>

                        <p>
                            <strong>Change:</strong>{" "}
                            ₱{Number(
                                transaction.change
                            ).toFixed(2)}
                        </p>

                        <p>
                            <strong>Date:</strong>{" "}
                            {new Date(
                                transaction.createdAt
                            ).toLocaleString()}
                        </p>

                        <hr className="transaction-divider" />
                    </div>
                ))
            )}
        </div>
    );
}

export default Transactions;