import "./Dashboard.css";

function Dashboard() {
    return (
        <div className="dashboard-page">
            <h1>Dashboard</h1>

            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <h2>₱0</h2>
                    <p>Total Sales</p>
                </div>

                <div className="dashboard-card">
                    <h2>0</h2>
                    <p>Transactions</p>
                </div>

                <div className="dashboard-card">
                    <h2>0</h2>
                    <p>Products</p>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;