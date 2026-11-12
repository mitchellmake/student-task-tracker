
const taskInput = document.getElementById("taskInput");
const dueDate = document.getElementById("dueDate");
const addTask = document.getElementById("addTask");
const taskList = document.getElementById("taskList");
const progress = document.getElementById("progress");

let tasks = [];
let completed = 0;

addTask.addEventListener("click", function () {
    const taskName = taskInput.value.trim();
    const date = dueDate.value;

    if (taskName === "") {
        alert("Please enter an assignment!");
        return;
    }

    const task = {
        id: Date.now(),
        name: taskName,
        date: date,
        done: false
    };

    tasks.push(task);
    saveTasks();
    displayTasks();

    taskInput.value = "";
    dueDate.value = "";
});

function displayTasks() {
    taskList.innerHTML = "";

    tasks.forEach(function (task) {
        const li = document.createElement("li");

        const name = document.createElement("span");
        name.textContent = task.name;

        const date = document.createElement("small");
        date.textContent = task.date
            ? " Due: " + task.date
            : "";

        const completeButton = document.createElement("button");
        completeButton.textContent = task.done
            ? "Completed"
            : "Mark Done";

        completeButton.style.marginLeft = "10px";

        completeButton.addEventListener("click", function () {
            task.done = !task.done;
            saveTasks();
            displayTasks();
        });

        li.append(name, date, completeButton);
        taskList.appendChild(li);
    });

    completed = tasks.filter(task => task.done).length;

    progress.textContent =
        `Completed: ${completed} / ${tasks.length}`;
}

function saveTasks() {
    localStorage.setItem("campuskitTasks", JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem("campuskitTasks");

    if (saved) {
        tasks = JSON.parse(saved);
    }

    displayTasks();
}

loadTasks();
