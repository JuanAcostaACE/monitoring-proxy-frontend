// Replace with your deployed Spring Boot Backend URL (e.g., https://your-backend.onrender.com/api)
const API_BASE_URL = "https://monitoring-proxy-backend.onrender.com/api";

let latencyChartInstance = null;
let volumeChartInstance = null;

function initCharts() {
    const latencyCtx = document.getElementById("latencyChart").getContext("2d");
    latencyChartInstance = new Chart(latencyCtx, {
        type: "bar",
        data: {
            labels: ["INVENTORY_SERVICE", "ORDER_SERVICE", "PAYMENT_SERVICE"],
            datasets: [{
                label: "Avg Latency (ms)",
                data: [0, 0, 0],
                backgroundColor: ["#38bdf8", "#818cf8", "#c084fc"]
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" } }, x: { ticks: { color: "#94a3b8" } } }
        }
    });

    const volumeCtx = document.getElementById("volumeChart").getContext("2d");
    volumeChartInstance = new Chart(volumeCtx, {
        type: "bar",
        data: {
            labels: ["INVENTORY_SERVICE", "ORDER_SERVICE", "PAYMENT_SERVICE"],
            datasets: [
                { label: "Total Calls", data: [0, 0, 0], backgroundColor: "#10b981" },
                { label: "Errors", data: [0, 0, 0], backgroundColor: "#f43f5e" }
            ]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" } }, x: { ticks: { color: "#94a3b8" } } }
        }
    });
}

async function triggerService(endpoint, operation) {
    try {
        await fetch(`${API_BASE_URL}/${endpoint}/${operation}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientTimestamp: new Date().toISOString() })
        });
    } catch (error) {
        console.error("Network error calling microservice proxy:", error);
    } finally {
        fetchDashboardMetrics();
    }
}

async function simulateTrafficBurst() {
    const scenarios = [
        { endpoint: "inventory", op: "CHECK_STOCK" },
        { endpoint: "orders", op: "CREATE_ORDER" },
        { endpoint: "payments", op: "PROCESS_PAYMENT" }
    ];
    for (let i = 0; i < 10; i++) {
        const pick = scenarios[Math.floor(Math.random() * scenarios.length)];
        triggerService(pick.endpoint, pick.op);
    }
}

async function fetchDashboardMetrics() {
    try {
        const response = await fetch(`${API_BASE_URL}/observability/metrics`);
        const data = await response.json();

        document.getElementById("kpiTotalCalls").innerText = data.totalCalls;
        document.getElementById("kpiAvgLatency").innerText = `${data.avgLatencyMs} ms`;
        document.getElementById("kpiErrorCount").innerText = data.errorCount;
        document.getElementById("kpiErrorRate").innerText = `${data.errorRate.toFixed(1)}%`;

        const services = ["INVENTORY_SERVICE", "ORDER_SERVICE", "PAYMENT_SERVICE"];
        latencyChartInstance.data.datasets[0].data = services.map(s => Math.round(data.avgLatencyByService[s] || 0));
        latencyChartInstance.update();

        volumeChartInstance.data.datasets[0].data = services.map(s => data.callsByService[s] || 0);
        volumeChartInstance.data.datasets[1].data = services.map(s => data.errorsByService[s] || 0);
        volumeChartInstance.update();

        const tbody = document.getElementById("auditTableBody");
        tbody.innerHTML = data.recentLogs.map(log => {
            const badgeClass = log.status === "SUCCESS"
                ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                : "bg-rose-950 text-rose-400 border border-rose-700";

            return `
                <tr class="hover:bg-slate-800/60">
                    <td class="p-3 text-slate-400">#${log.id}</td>
                    <td class="p-3 text-slate-300">${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td class="p-3 font-semibold text-cyan-300">${log.serviceName}</td>
                    <td class="p-3">${log.operation}</td>
                    <td class="p-3 text-amber-300">${log.responseTimeMs} ms</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-xs ${badgeClass}">${log.status}</span></td>
                    <td class="p-3 text-slate-400 truncate max-w-xs">${log.message}</td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Error fetching observability metrics:", err);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    initCharts();
    fetchDashboardMetrics();
    setInterval(fetchDashboardMetrics, 2500);
});
