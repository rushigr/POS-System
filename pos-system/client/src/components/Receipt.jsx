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

    const printReceipt = () => {
        // Print in a standalone window so the app's hidden page layout cannot
        // create blank pages or push the receipt away from the top of paper.
        const printWindow = window.open(
            "",
            "_blank",
            "width=420,height=720"
        );

        if (!printWindow) {
            window.alert(
                "The print window was blocked. Allow pop-ups for this site, then try again."
            );
            return;
        }

        const escapeHtml = (value) =>
            String(value ?? "").replace(/[&<>\"']/g, (character) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]);

        const itemRows = items.map((item) => {
            const quantity = Number(item.quantity || 0);
            const price = Number(item.price || 0);
            const notes = item.notes?.trim()
                ? `<div class="item-note">Note: ${escapeHtml(item.notes)}</div>`
                : "";

            return `
                <tr>
                    <td class="item-name">
                        <strong>${escapeHtml(item.name || "Item")}</strong>
                        ${notes}
                    </td>
                    <td>${quantity}</td>
                    <td>${escapeHtml(peso(price))}</td>
                    <td>${escapeHtml(peso(price * quantity))}</td>
                </tr>
            `;
        }).join("");

        const discountRow = discountAmount > 0
            ? `
                <div class="discount-row">
                    <span>${escapeHtml(discountLabel(transaction.discountType))}${
                        Number(transaction.discountRate || 0) > 0
                            ? ` (${Number(transaction.discountRate)}%)`
                            : ""
                    }</span>
                    <span>−${escapeHtml(peso(discountAmount))}</span>
                </div>
            `
            : "";

        const dateText = createdAt.toLocaleDateString("en-PH");
        const timeText = createdAt.toLocaleTimeString("en-PH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Receipt ${escapeHtml(transaction.transactionNumber || "")}</title>
    <style>
        @page { margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; min-height: 0; }
        body {
            background: #fff;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1.35;
        }
        .receipt {
            width: 72mm;
            max-width: 100%;
            margin: 0 auto;
            padding: 3mm 1mm;
            background: #fff;
            overflow-wrap: anywhere;
        }
        .brand { text-align: center; margin-bottom: 4mm; }
        .brand h1 { margin: 0 0 1mm; font-size: 18px; letter-spacing: .02em; }
        .brand p { margin: 0; font-size: 10px; font-weight: bold; letter-spacing: .12em; }
        .void-banner { display: block; margin-top: 2mm; color: #b91c1c; font-weight: bold; }
        .meta { display: grid; grid-template-columns: 1fr; gap: 1.5mm; margin: 3mm 0; }
        .meta-row { display: flex; justify-content: space-between; gap: 3mm; }
        .meta-row span { color: #444; }
        .meta-row strong { text-align: right; overflow-wrap: anywhere; }
        .dash { border-top: 1px dashed #444; margin: 3mm 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { padding: 1.5mm .4mm; font-size: 9px; vertical-align: top; text-align: right; }
        th { border-bottom: 1px solid #555; }
        th:first-child, td:first-child { width: 43%; text-align: left; }
        th:nth-child(2), td:nth-child(2) { width: 9%; }
        th:nth-child(3), td:nth-child(3) { width: 23%; }
        th:nth-child(4), td:nth-child(4) { width: 25%; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .item-name strong { display: block; }
        .item-note { margin-top: 1mm; color: #444; font-size: 8px; }
        .totals { display: flex; flex-direction: column; gap: 2mm; }
        .total-row { display: flex; justify-content: space-between; gap: 3mm; }
        .total-row span:last-child { text-align: right; }
        .discount-row { display: flex; justify-content: space-between; gap: 3mm; color: #111; }
        .grand-total { margin: 2mm 0; padding: 2.5mm 0; border-top: 1px solid #111; border-bottom: 1px solid #111; font-size: 13px; font-weight: bold; }
        .void-reason { margin-top: 3mm; color: #b91c1c; }
        .footer { margin-top: 5mm; text-align: center; }
        .footer p { margin: 0 0 1mm; font-weight: bold; }
        .footer small { font-size: 8px; }
        @media screen {
            body { background: #e5e7eb; padding: 10px 0; }
            .receipt { background: #fff; box-shadow: 0 2px 10px #0002; }
        }
        @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
            .receipt { margin: 0 auto !important; padding: 3mm 1mm !important; }
        }
    </style>
</head>
<body>
    <main class="receipt">
        <header class="brand">
            <h1>Houdo Ramen</h1>
            <p>SALES RECEIPT</p>
            ${isVoided ? '<strong class="void-banner">VOIDED TRANSACTION</strong>' : ""}
        </header>

        <section class="meta">
            <div class="meta-row"><span>Receipt No.</span><strong>${escapeHtml(transaction.transactionNumber || "—")}</strong></div>
            <div class="meta-row"><span>Date</span><strong>${escapeHtml(dateText)}</strong></div>
            <div class="meta-row"><span>Time</span><strong>${escapeHtml(timeText)}</strong></div>
            <div class="meta-row"><span>Cashier</span><strong>${escapeHtml(transaction.cashier || "Unknown")}</strong></div>
        </section>

        <div class="dash"></div>
        <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
            <tbody>${itemRows}</tbody>
        </table>
        <div class="dash"></div>

        <section class="totals">
            <div class="total-row"><span>Items</span><span>${itemCount}</span></div>
            <div class="total-row"><span>Subtotal</span><span>${escapeHtml(peso(transaction.subtotal))}</span></div>
            ${discountRow}
            <div class="total-row grand-total"><strong>TOTAL</strong><strong>${escapeHtml(peso(transaction.total))}</strong></div>
            <div class="total-row"><span>Payment</span><span>${escapeHtml(transaction.paymentMethod || "Cash")}</span></div>
            <div class="total-row"><span>Amount paid</span><span>${escapeHtml(peso(transaction.amountPaid))}</span></div>
            <div class="total-row"><span>Change</span><span>${escapeHtml(peso(transaction.change))}</span></div>
        </section>

        ${isVoided && transaction.voidReason
            ? `<p class="void-reason">Void reason: ${escapeHtml(transaction.voidReason)}</p>`
            : ""}

        <footer class="footer">
            <p>Thank you for dining with us!</p>
            <small>Please keep this receipt for your records.</small>
        </footer>
    </main>
</body>
</html>`;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.onafterprint = () => printWindow.close();
        printWindow.focus();
        // The popup contains only the receipt, not the app's page layout.
        window.setTimeout(() => {
            if (!printWindow.closed) printWindow.print();
        }, 300);
    };

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