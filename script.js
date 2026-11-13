
// CAMPUSKIT - MAIN APPLICATION

const taskInput = document.getElementById("taskInput");
const dueDate = document.getElementById("dueDate");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const progress = document.getElementById("progress");

// Assignments are loaded from Supabase for the signed-in student.
let tasks = [];
let currentUserId = null;
let assignmentsReady = false;
let assignmentLoadVersion = 0;

let currentFilter = "all";

// -----------------------------
// CLOUD ASSIGNMENT STORAGE
// -----------------------------

async function loadAssignments(user) {
    const version = ++assignmentLoadVersion;
    currentUserId = user.id;
    assignmentsReady = false;
    tasks = [];
    displayTasks();
    renderCalendar();

    const { data, error } = await window.campuskitSupabase
        .from("assignments")
        .select("id, title, due_date, is_completed, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    if (version !== assignmentLoadVersion) return;

    if (error) {
        alert("Could not load your assignments: " + error.message);
        return;
    }

    tasks = (data || []).map(row => ({
        id: row.id,
        name: row.title,
        date: row.due_date || "",
        done: row.is_completed
    }));

    assignmentsReady = true;
    displayTasks();
    renderCalendar();
}

function clearAssignments() {
    assignmentLoadVersion++;
    currentUserId = null;
    assignmentsReady = false;
    tasks = [];
    displayTasks();
    renderCalendar();
}

function todayString() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

dueDate.min = todayString();

// -----------------------------
// DASHBOARD STATISTICS
// -----------------------------

function updateDashboard() {
    const completed = tasks.filter(task => task.done).length;
    const pending = tasks.length - completed;

    document.getElementById("totalTasks").textContent = tasks.length;
    document.getElementById("pendingTasks").textContent = pending;
    document.getElementById("completedTasks").textContent = completed;

    progress.textContent = `Completed: ${completed} / ${tasks.length}`;
}

// -----------------------------
// DISPLAY ASSIGNMENTS
// -----------------------------

function displayTasks() {
    taskList.replaceChildren();

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "pending") return !task.done;
        if (currentFilter === "completed") return task.done;
        return true;
    });

    if (filteredTasks.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No assignments here yet. Add your first task!";
        taskList.appendChild(empty);
    }

    filteredTasks.forEach(task => {
        const item = document.createElement("li");
        item.className = "task-item";

        if (task.done) item.classList.add("is-done");

        const details = document.createElement("div");
        details.className = "task-details";

        const name = document.createElement("strong");
        name.textContent = task.name;

        const date = document.createElement("small");
        date.textContent = task.date
            ? "Due: " + task.date
            : "No due date";

        details.append(name, date);

        if (task.date && !task.done && task.date < todayString()) {
            const overdue = document.createElement("span");
            overdue.className = "overdue";
            overdue.textContent = "Overdue";
            details.appendChild(overdue);
        }

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const completeButton = document.createElement("button");
        completeButton.type = "button";
        completeButton.textContent = task.done ? "Undo" : "Mark done";

        completeButton.addEventListener("click", async () => {
            if (!currentUserId || !assignmentsReady) return;

            const newDoneState = !task.done;
            const { error } = await window.campuskitSupabase
                .from("assignments")
                .update({ is_completed: newDoneState })
                .eq("id", task.id)
                .eq("user_id", currentUserId);

            if (error) {
                alert("Could not update this assignment: " + error.message);
                return;
            }

            task.done = newDoneState;
            displayTasks();
            renderCalendar();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", async () => {
            if (!currentUserId || !assignmentsReady) return;
            if (confirm("Delete this assignment?")) {
                const { error } = await window.campuskitSupabase
                    .from("assignments")
                    .delete()
                    .eq("id", task.id)
                    .eq("user_id", currentUserId);

                if (error) {
                    alert("Could not delete this assignment: " + error.message);
                    return;
                }

                tasks = tasks.filter(item => item.id !== task.id);
                displayTasks();
                renderCalendar();
            }
        });

        actions.append(completeButton, deleteButton);
        item.append(details, actions);
        taskList.appendChild(item);
    });

    updateDashboard();

    document.querySelectorAll(".filters button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.filter === currentFilter
        );
    });
}

// -----------------------------
// ADD ASSIGNMENTS
// -----------------------------

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = taskInput.value.trim();
    const date = dueDate.value;

    if (!name) {
        alert("Please enter an assignment name.");
        return;
    }

    if (date && date < todayString()) {
        alert("Please choose today or a future deadline.");
        return;
    }

    if (!currentUserId || !assignmentsReady) {
        alert("Your assignments are still loading. Please try again.");
        return;
    }

    const { data, error } = await window.campuskitSupabase
        .from("assignments")
        .insert({
            user_id: currentUserId,
            title: name,
            due_date: date || null,
            is_completed: false
        })
        .select("id, title, due_date, is_completed")
        .single();

    if (error) {
        alert("Could not save this assignment: " + error.message);
        return;
    }

    tasks.push({
        id: data.id,
        name: data.title,
        date: data.due_date || "",
        done: data.is_completed
    });

    taskInput.value = "";
    dueDate.value = "";

    displayTasks();
    renderCalendar();
});

// -----------------------------
// ASSIGNMENT FILTERS
// -----------------------------

document.querySelector(".filters").addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");

    if (!button) return;

    currentFilter = button.dataset.filter;
    displayTasks();
});

// -----------------------------
// DEADLINE CALENDAR
// -----------------------------

let calendarDate = new Date();
calendarDate = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    1
);

function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const monthLabel = document.getElementById("monthLabel");

    grid.replaceChildren();

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    monthLabel.textContent = calendarDate.toLocaleDateString(
        "en",
        { month: "long", year: "numeric" }
    );

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    weekdays.forEach(day => {
        const cell = document.createElement("div");
        cell.className = "calendar-day weekday";
        cell.textContent = day;
        grid.appendChild(cell);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement("div");
        grid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.textContent = day;

        const dateString = [
            year,
            String(month + 1).padStart(2, "0"),
            String(day).padStart(2, "0")
        ].join("-");

        if (dateString === todayString()) {
            cell.classList.add("today");
            cell.setAttribute("aria-label", `Today, ${day}`);
        }

        const hasDeadline = tasks.some(
            task => task.date === dateString && !task.done
        );

        if (hasDeadline) {
            cell.classList.add("has-deadline");
            cell.setAttribute(
                "aria-label",
                `${day}, assignment deadline`
            );
            cell.title = "Assignment deadline";
        }

        grid.appendChild(cell);
    }
}

document.getElementById("prevMonth").addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
});

// -----------------------------
// DAILY STUDY QUOTES
// -----------------------------

const quotes = [
    "Great things are done by a series of small things brought together.",
    "Your future is created by what you do today.",
    "Believe in your ability to learn something new.",
    "Progress, not perfection.",
    "Every expert was once a beginner.",
    "Small steps every day lead to big achievements.",
    "Your effort today is an investment in tomorrow."
];

let currentQuoteIndex = -1;

function displayDailyQuote() {
    let nextIndex = Math.floor(Math.random() * quotes.length);
    if (quotes.length > 1 && nextIndex === currentQuoteIndex) {
        nextIndex = (nextIndex + 1) % quotes.length;
    }
    currentQuoteIndex = nextIndex;
    document.getElementById("dailyQuote").textContent =
        '"' + quotes[currentQuoteIndex] + '"';
}

// Refresh the motivational quote every five minutes.
setInterval(displayDailyQuote, 5 * 60 * 1000);

// -----------------------------
// POMODORO STUDY TIMER
// -----------------------------

let remainingSeconds = 25 * 60;
let timerInterval = null;

const timerDisplay = document.getElementById("timerDisplay");
const timerStatus = document.getElementById("timerStatus");
const startTimer = document.getElementById("startTimer");

function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    timerDisplay.textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");
}

startTimer.addEventListener("click", () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        startTimer.textContent = "Resume";
        timerStatus.textContent = "PAUSED";
        return;
    }

    if (remainingSeconds <= 0) {
        return;
    }

    startTimer.textContent = "Pause";
    timerStatus.textContent = "FOCUSING";

    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay();

        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;

            startTimer.textContent = "Start again";
            timerStatus.textContent = "SESSION COMPLETE";

            if ("Notification" in window &&
                Notification.permission === "granted") {
                new Notification("CampusKit", {
                    body: "Your study session is complete!"
                });
            }
        }
    }, 1000);
});

document.getElementById("resetTimer").addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;

    remainingSeconds = 25 * 60;
    updateTimerDisplay();

    startTimer.textContent = "Start";
    timerStatus.textContent = "READY TO FOCUS";
});

// -----------------------------
// PERSONAL STUDY NOTES
// -----------------------------

const studyNotes = document.getElementById("studyNotes");
const notesStatus = document.getElementById("notesStatus");

studyNotes.value = localStorage.getItem("campuskitNotes") || "";

studyNotes.addEventListener("input", () => {
    try {
        localStorage.setItem("campuskitNotes", studyNotes.value);
        notesStatus.textContent = "Saved on this device.";
    } catch {
        notesStatus.textContent = "Unable to save. Check device storage.";
    }
});

// -----------------------------
// INITIALISE CAMPUSKIT
// -----------------------------

displayTasks();
renderCalendar();
displayDailyQuote();
updateTimerDisplay();

// Load only the signed-in student's assignments. Supabase RLS provides
// the final access-control boundary; the user_id filter is an extra guard.
window.campuskitSupabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
        // Defer the query until the auth callback has completed.
        setTimeout(() => loadAssignments(session.user), 0);
    } else if (event === "SIGNED_OUT") {
        clearAssignments();
    }
});

(async function initialiseCloudAssignments() {
    const { data, error } = await window.campuskitSupabase.auth.getSession();

    if (error) {
        alert("Could not check your sign-in status. Please refresh.");
        return;
    }

    if (data.session?.user) {
        await loadAssignments(data.session.user);
    } else {
        clearAssignments();
    }
})();
