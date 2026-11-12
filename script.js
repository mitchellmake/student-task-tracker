
const taskInput = document.getElementById("taskInput");
const dueDate = document.getElementById("dueDate");
const addTask = document.getElementById("addTask");
const taskList = document.getElementById("taskList");
const progress = document.getElementById("progress");

let tasks = JSON.parse(localStorage.getItem("campuskitTasks") || "[]");
let currentFilter = "all";

// Create dashboard statistics
const dashboard = document.querySelector(".dashboard");

const stats = document.createElement("div");
stats.className = "stats";

stats.innerHTML = `
    <div class="stat-card">
        <span>Total tasks</span>
        <strong id="totalTasks">0</strong>
    </div>
    <div class="stat-card">
        <span>Pending</span>
        <strong id="pendingTasks">0</strong>
    </div>
    <div class="stat-card">
        <span>Completed</span>
        <strong id="completedTasks">0</strong>
    </div>
`;

dashboard.insertBefore(stats, taskList.parentElement);

const filters = document.createElement("div");
filters.className = "filters";

filters.innerHTML = `
    <button data-filter="all">All</button>
    <button data-filter="pending">Pending</button>
    <button data-filter="completed">Completed</button>
`;

taskList.parentElement.insertBefore(filters, taskList);

function saveTasks() {
    localStorage.setItem("campuskitTasks", JSON.stringify(tasks));
}

function updateDashboard() {
    const completed = tasks.filter(task => task.done).length;
    const pending = tasks.length - completed;

    document.getElementById("totalTasks").textContent = tasks.length;
    document.getElementById("pendingTasks").textContent = pending;
    document.getElementById("completedTasks").textContent = completed;

    progress.textContent = `Completed: ${completed} / ${tasks.length}`;
}

function displayTasks() {
    taskList.innerHTML = "";

    const today = new Date();
    const todayString = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "pending") return !task.done;
        if (currentFilter === "completed") return task.done;
        return true;
    });

    if (filteredTasks.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "No assignments here yet.";
        taskList.appendChild(empty);
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");
        li.className = "task-item";

        const details = document.createElement("div");
        details.className = "task-details";

        const name = document.createElement("strong");
        name.textContent = task.name;

        const date = document.createElement("small");
        date.textContent = task.date
            ? "Due: " + task.date
            : "No due date";

        details.append(name, date);

        if (task.date && !task.done && task.date < todayString) {
            const overdue = document.createElement("span");
            overdue.className = "overdue";
            overdue.textContent = "Overdue";
            details.appendChild(overdue);
        }

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const completeButton = document.createElement("button");
        completeButton.textContent = task.done ? "Undo" : "Complete";

        completeButton.addEventListener("click", () => {
            task.done = !task.done;
            saveTasks();
            displayTasks();
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", () => {
            if (confirm("Delete this assignment?")) {
                tasks = tasks.filter(item => item.id !== task.id);
                saveTasks();
                displayTasks();
            }
        });

        actions.append(completeButton, deleteButton);
        li.append(details, actions);
        taskList.appendChild(li);
    });

    updateDashboard();

    document.querySelectorAll(".filters button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.filter === currentFilter
        );
    });
}

addTask.addEventListener("click", () => {
    const name = taskInput.value.trim();
    const date = dueDate.value;

    if (!name) {
        alert("Please enter an assignment!");
        return;
    }

    if (date && date < (() => {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    })()) {
        alert("Please select today or a future due date.");
        return;
    }

    tasks.push({
        id: Date.now(),
        name: name,
        date: date,
        done: false
    });

    saveTasks();
    taskInput.value = "";
    dueDate.value = "";
    displayTasks();
});

filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");

    if (!button) return;

    currentFilter = button.dataset.filter;
    displayTasks();
});

displayTasks();
