import "./Receipt.css";

const peso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

const discountLabel = (type) => {
    const labels = {
        senior_citizen: "Senior Citizen",
        pwd: "PWD",
        custom: "Custom discount",
        none: "No discount"
    };
    return labels[type] || "Discount";
};

function Receipt({ transaction, onClose }) {
    if (!transaction) return null;

    const createdAt = transaction.createdAt
        ? new Date(transaction.createdAt)
        : new Date();
    const items = Array.isArray(transaction.items) ? transaction.items : [];
    const itemCount = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );
    const discountAmount = Number(transaction.discountAmount || 0);
    const isVoided = transaction.status === "voided";

    const printReceipt = () => window.print();

    return (
        <div
            className="receipt-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <section
                className="receipt-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="receipt-dialog-title"
            >
                <div className="receipt-screen-heading">
                    <div>
                        <h2 id="receipt-dialog-title">Receipt</h2>
                        <p>Transaction saved successfully.</p>
                    </div>
                    <button
                        type="button"
                        className="receipt-close"
                        onClick={onClose}
                        aria-label="Close receipt"
                    >
                        ×
                    </button>
                </div>

                <div className="receipt-print-area">
                    <header className="receipt-brand">
                        <h1>Houdo Ramen</h1>
                        <p>SALES RECEIPT</p>
                        {isVoided && <strong className="receipt-void-banner">VOIDED TRANSACTION</strong>}
                    </header>

                    <div className="receipt-meta">
                        <div>
                            <span>Receipt No.</span>
                            <strong>{transaction.transactionNumber || "—"}</strong>
                        </div>
                        <div>
                            <span>Date</span>
                            <strong>{createdAt.toLocaleDateString("en-PH")}</strong>
                        </div>
                        <div>
                            <span>Time</span>
                            <strong>{createdAt.toLocaleTimeString("en-PH", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            })}</strong>
                        </div>
                        <div>
                            <span>Cashier</span>
                            <strong>{transaction.cashier || "Unknown"}</strong>
                        </div>
                    </div>

                    <div className="receipt-dash" />

                    <table className="receipt-items-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={`${item.name || "item"}-${index}`}>
                                    <td className="receipt-item-name">
                                        <strong>{item.name || "Item"}</strong>
                                        {item.notes?.trim() && (
                                            <small>Note: {item.notes}</small>
                                        )}
                                    </td>
                                    <td>{Number(item.quantity || 0)}</td>
                                    <td>{peso(item.price)}</td>
                                    <td>{peso(Number(item.price || 0) * Number(item.quantity || 0))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="receipt-dash" />

                    <div className="receipt-totals">
                        <div><span>Items</span><span>{itemCount}</span></div>
                        <div><span>Subtotal</span><span>{peso(transaction.subtotal)}</span></div>
                        {discountAmount > 0 && (
                            <div className="receipt-discount-row">
                                <span>
                                    {discountLabel(transaction.discountType)}
                                    {Number(transaction.discountRate || 0) > 0
                                        ? ` (${Number(transaction.discountRate)}%)`
                                        : ""}
                                </span>
                                <span>−{peso(discountAmount)}</span>
                            </div>
                        )}
                        <div className="receipt-grand-total">
                            <strong>TOTAL</strong>
                            <strong>{peso(transaction.total)}</strong>
                        </div>
                        <div><span>Payment</span><span>{transaction.paymentMethod || "Cash"}</span></div>
                        <div><span>Amount paid</span><span>{peso(transaction.amountPaid)}</span></div>
                        <div><span>Change</span><span>{peso(transaction.change)}</span></div>
                    </div>

                    {isVoided && transaction.voidReason && (
                        <p className="receipt-void-reason">
                            Void reason: {transaction.voidReason}
                        </p>
                    )}

                    <footer className="receipt-footer">
                        <p>Thank you for dining with us!</p>
                        <small>Please keep this receipt for your records.</small>
                    </footer>
                </div>

                <div className="receipt-actions">
                    <button type="button" className="receipt-secondary-btn" onClick={onClose}>
                        Close
                    </button>
                    <button type="button" className="receipt-print-btn" onClick={printReceipt}>
                        Print Receipt
                    </button>
                </div>
            </section>
        </div>
    );
}

export default Receipt;