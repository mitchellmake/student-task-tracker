// CAMPUSKIT - PHASE 1
const $ = id => document.getElementById(id);
const taskInput=$("taskInput"), dueDate=$("dueDate"), taskForm=$("taskForm"), taskList=$("taskList"), progress=$("progress");
const courseInput=$("courseInput"), priorityInput=$("priorityInput"), taskSearch=$("taskSearch"), taskSort=$("taskSort");
let tasks=[], currentUserId=null, assignmentsReady=false, assignmentLoadVersion=0, currentFilter="all";
const palette=["#6B8EBD","#8B78C6","#5D9C83","#D18B55","#C77991","#4C9A9A"];
const priorityRank={High:0,Medium:1,Low:2};
function colourForCourse(course){let hash=0;for(const ch of (course||"General").trim().toLowerCase())hash=(hash*31+ch.charCodeAt(0))>>>0;return palette[hash%palette.length];}
function dateDelta(date){if(!date)return null;const [y,m,d]=date.split("-").map(Number);const due=Date.UTC(y,m-1,d);const [ty,tm,td]=todayString().split("-").map(Number);return Math.round((due-Date.UTC(ty,tm-1,td))/86400000);}
function todayString(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
dueDate.min=todayString();
async function loadAssignments(user){
 const version=++assignmentLoadVersion;currentUserId=user.id;assignmentsReady=false;tasks=[];displayTasks();renderCalendar();
 const {data,error}=await window.campuskitSupabase.from("assignments").select("id,title,due_date,is_completed,created_at,course,course_color,priority").eq("user_id",user.id).order("created_at",{ascending:true});
 if(version!==assignmentLoadVersion)return;if(error){alert("Could not load assignments: "+error.message);return;}
 tasks=(data||[]).map(r=>({id:r.id,name:r.title,date:r.due_date||"",done:r.is_completed,course:r.course||"General",courseColor:palette.includes(r.course_color)?r.course_color:colourForCourse(r.course),priority:["High","Medium","Low"].includes(r.priority)?r.priority:"Medium",created:r.created_at}));
 assignmentsReady=true;displayTasks();renderCalendar();checkReminders();
}
function clearAssignments(){assignmentLoadVersion++;currentUserId=null;assignmentsReady=false;tasks=[];displayTasks();renderCalendar();}
function updateDashboard(){const done=tasks.filter(t=>t.done).length;$("totalTasks").textContent=tasks.length;$("pendingTasks").textContent=tasks.length-done;$("completedTasks").textContent=done;progress.textContent=`Completed: ${done} / ${tasks.length}`;}
function makeBadge(text,cls){const e=document.createElement("span");e.className=cls;e.textContent=text;return e;}
function dueLabel(task){if(!task.date||task.done)return null;const n=dateDelta(task.date);if(n<0)return ["Overdue","due-badge overdue"];if(n===0)return ["Due today","due-badge today"];if(n<=3)return [`Due in ${n} day${n===1?"":"s"}`,"due-badge soon"];return null;}
function sortTasks(list){const copy=[...list];if(taskSort.value==="priority")copy.sort((a,b)=>priorityRank[a.priority]-priorityRank[b.priority]);else if(taskSort.value==="course")copy.sort((a,b)=>a.course.localeCompare(b.course));else if(taskSort.value==="created")copy.sort((a,b)=>new Date(b.created||0)-new Date(a.created||0));else copy.sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));return copy;}
function displayTasks(){
 taskList.replaceChildren();const term=(taskSearch?.value||"").trim().toLowerCase();
 const visible=sortTasks(tasks.filter(t=>(currentFilter==="all"||(currentFilter==="pending"&&!t.done)||(currentFilter==="completed"&&t.done))&&(`${t.name} ${t.course}`.toLowerCase().includes(term))));
 if(!visible.length){const e=document.createElement("li");e.className="empty-state";e.textContent=term?"No matching assignments.":"No assignments here yet. Add your first task!";taskList.append(e);}
 visible.forEach(task=>{
  const item=document.createElement("li");item.className="task-item"+(task.done?" is-done":"");
  const details=document.createElement("div");details.className="task-details";
  const name=document.createElement("strong");name.textContent=task.name;
  const date=document.createElement("small");date.textContent=task.date?"Due: "+task.date:"No due date";
  const meta=document.createElement("div");meta.className="task-meta";
  const tag=makeBadge(task.course,"course-tag");tag.style.color=task.courseColor;tag.style.borderColor=task.courseColor;tag.style.backgroundColor=task.courseColor+"20";
  meta.append(tag,makeBadge(task.priority+" priority","priority-badge "+task.priority.toLowerCase()));
  const due=dueLabel(task);if(due)meta.append(makeBadge(due[0],due[1]));
  details.append(name,date,meta);
  const actions=document.createElement("div");actions.className="task-actions";
  const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.className="edit-button";edit.addEventListener("click",()=>showEditor(item,task));
  const done=document.createElement("button");done.type="button";done.textContent=task.done?"Undo":"Mark done";done.addEventListener("click",()=>setCompleted(task));
  const del=document.createElement("button");del.type="button";del.textContent="Delete";del.className="delete-button";del.addEventListener("click",()=>deleteTask(task));
  actions.append(edit,done,del);item.append(details,actions);taskList.append(item);
 });
 updateDashboard();document.querySelectorAll(".filters button").forEach(b=>b.classList.toggle("active",b.dataset.filter===currentFilter));
}
function showEditor(item,task){
 item.replaceChildren();const form=document.createElement("form");form.className="edit-form";
 const fields=[["text",task.name,"Assignment name"],["text",task.course,"Course / subject"],["date",task.date,"Due date"]];
 const inputs=fields.map(([type,value,placeholder])=>{const i=document.createElement("input");i.type=type;i.value=value;i.placeholder=placeholder;if(type==="text")i.maxLength=100;return i;});
 const priority=document.createElement("select");["High","Medium","Low"].forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v+" priority";priority.append(o);});priority.value=task.priority;
 const actions=document.createElement("div");actions.className="edit-actions";const save=document.createElement("button");save.type="submit";save.className="primary-button";save.textContent="Save changes";const cancel=document.createElement("button");cancel.type="button";cancel.className="secondary-button";cancel.textContent="Cancel";cancel.addEventListener("click",displayTasks);actions.append(save,cancel);form.append(...inputs,priority,actions);
 form.addEventListener("submit",async e=>{e.preventDefault();const name=inputs[0].value.trim(),course=inputs[1].value.trim()||"General",date=inputs[2].value;if(!name){alert("Enter an assignment name.");return;}const courseColor=colourForCourse(course);const {error}=await window.campuskitSupabase.from("assignments").update({title:name,course,course_color:courseColor,due_date:date||null,priority:priority.value}).eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not save changes: "+error.message);return;}Object.assign(task,{name,course,date,courseColor,priority:priority.value});displayTasks();renderCalendar();});item.append(form);
}
async function setCompleted(task){if(!currentUserId||!assignmentsReady)return;const next=!task.done;const {error}=await window.campuskitSupabase.from("assignments").update({is_completed:next}).eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not update assignment: "+error.message);return;}task.done=next;displayTasks();renderCalendar();}
async function deleteTask(task){if(!currentUserId||!assignmentsReady||!confirm("Delete this assignment?"))return;const {error}=await window.campuskitSupabase.from("assignments").delete().eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not delete assignment: "+error.message);return;}tasks=tasks.filter(t=>t.id!==task.id);displayTasks();renderCalendar();}
taskForm.addEventListener("submit",async e=>{e.preventDefault();const name=taskInput.value.trim(),date=dueDate.value,course=courseInput.value.trim()||"General",priority=priorityInput.value,courseColor=colourForCourse(course);if(!name){alert("Please enter an assignment name.");return;}if(date&&date<todayString()){alert("Please choose today or a future deadline.");return;}if(!currentUserId||!assignmentsReady){alert("Your assignments are still loading. Please try again.");return;}const {data,error}=await window.campuskitSupabase.from("assignments").insert({user_id:currentUserId,title:name,due_date:date||null,is_completed:false,course,course_color:courseColor,priority}).select("id,title,due_date,is_completed,created_at,course,course_color,priority").single();if(error){alert("Could not save assignment: "+error.message);return;}tasks.push({id:data.id,name:data.title,date:data.due_date||"",done:data.is_completed,course:data.course,courseColor:data.course_color,priority:data.priority,created:data.created_at});taskInput.value="";dueDate.value="";courseInput.value="";priorityInput.value="Medium";displayTasks();renderCalendar();});
document.querySelector(".filters").addEventListener("click",e=>{const b=e.target.closest("button[data-filter]");if(b){currentFilter=b.dataset.filter;displayTasks();}});
taskSearch.addEventListener("input",displayTasks);taskSort.addEventListener("change",displayTasks);
let calendarDate=new Date();calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth(),1);
function renderCalendar(){
 const grid=$("calendarGrid"),label=$("monthLabel");grid.replaceChildren();const y=calendarDate.getFullYear(),m=calendarDate.getMonth();label.textContent=calendarDate.toLocaleDateString("en",{month:"long",year:"numeric"});
 ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d=>{const c=document.createElement("div");c.className="calendar-day weekday";c.textContent=d;grid.append(c);});
 const first=new Date(y,m,1).getDay(),count=new Date(y,m+1,0).getDate();for(let i=0;i<first;i++)grid.append(document.createElement("div"));
 for(let d=1;d<=count;d++){const c=document.createElement("div");c.className="calendar-day";const date=[y,String(m+1).padStart(2,"0"),String(d).padStart(2,"0")].join("-");const num=document.createElement("span");num.className="day-number";num.textContent=d;c.append(num);if(date===todayString())c.classList.add("today");const colours=[...new Set(tasks.filter(t=>t.date===date&&!t.done).map(t=>t.courseColor||colourForCourse(t.course)))];if(colours.length){const dots=document.createElement("span");dots.className="calendar-dots";colours.slice(0,4).forEach(col=>{const dot=document.createElement("span");dot.style.backgroundColor=col;dots.append(dot);});c.append(dots);c.title=tasks.filter(t=>t.date===date&&!t.done).map(t=>t.course+": "+t.name).join(", ");}grid.append(c);}
}
$("prevMonth").addEventListener("click",()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar();});$("nextMonth").addEventListener("click",()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar();});
const quotes=["Great things are done by a series of small things brought together.","Your future is created by what you do today.","Believe in your ability to learn something new.","Progress, not perfection.","Every expert was once a beginner.","Small steps every day lead to big achievements.","Your effort today is an investment in tomorrow."];
let quoteIndex=-1;function displayDailyQuote(){let n=Math.floor(Math.random()*quotes.length);if(n===quoteIndex)n=(n+1)%quotes.length;quoteIndex=n;$("dailyQuote").textContent='"'+quotes[n]+'"';}setInterval(displayDailyQuote,300000);
let remainingSeconds=1500,timerInterval=null;const timerDisplay=$("timerDisplay"),timerStatus=$("timerStatus"),startTimer=$("startTimer");
function updateTimerDisplay(){timerDisplay.textContent=String(Math.floor(remainingSeconds/60)).padStart(2,"0")+":"+String(remainingSeconds%60).padStart(2,"0");}
startTimer.addEventListener("click",()=>{if(timerInterval){clearInterval(timerInterval);timerInterval=null;startTimer.textContent="Resume";timerStatus.textContent="PAUSED";return;}if(remainingSeconds<=0)return;startTimer.textContent="Pause";timerStatus.textContent="FOCUSING";timerInterval=setInterval(()=>{remainingSeconds--;updateTimerDisplay();if(remainingSeconds<=0){clearInterval(timerInterval);timerInterval=null;startTimer.textContent="Start again";timerStatus.textContent="SESSION COMPLETE";if("Notification"in window&&Notification.permission==="granted")new Notification("CampusKit",{body:"Your study session is complete!"});}},1000);});
$("resetTimer").addEventListener("click",()=>{clearInterval(timerInterval);timerInterval=null;remainingSeconds=1500;updateTimerDisplay();startTimer.textContent="Start";timerStatus.textContent="READY TO FOCUS";});
const studyNotes=$("studyNotes"),notesStatus=$("notesStatus");studyNotes.value=localStorage.getItem("campuskitNotes")||"";studyNotes.addEventListener("input",()=>{try{localStorage.setItem("campuskitNotes",studyNotes.value);notesStatus.textContent="Saved on this device.";}catch{notesStatus.textContent="Unable to save. Check device storage."; }});
const themeToggle=$("themeToggle");function setTheme(mode){document.body.classList.toggle("dark-mode",mode==="dark");themeToggle.textContent=mode==="dark"?"☀️":"🌙";themeToggle.setAttribute("aria-label",mode==="dark"?"Switch to light mode":"Switch to dark mode");localStorage.setItem("campuskitTheme",mode);}setTheme(localStorage.getItem("campuskitTheme")||"light");themeToggle.addEventListener("click",()=>setTheme(document.body.classList.contains("dark-mode")?"light":"dark"));
const reminderLogKey=()=>`campuskitReminders:${currentUserId||"guest"}`;function checkReminders(){if(!("Notification"in window)||Notification.permission!=="granted"||!currentUserId)return;const now=new Date(),log=JSON.parse(localStorage.getItem(reminderLogKey())||"{}");tasks.filter(t=>!t.done&&t.date).forEach(t=>{const [y,m,d]=t.date.split("-").map(Number);const due=new Date(y,m-1,d,9,0,0);[["day",86400000],["hour",3600000]].forEach(([kind,offset])=>{const target=due.getTime()-offset;if(now.getTime()>=target&&now.getTime()<target+60000&&!log[t.id+":"+kind]){new Notification("CampusKit deadline reminder",{body:`${t.name} (${t.course}) is due ${kind==="day"?"tomorrow":"in about one hour"}.`});log[t.id+":"+kind]=true;}});});localStorage.setItem(reminderLogKey(),JSON.stringify(log));}
$("enableReminders").addEventListener("click",async()=>{if(!("Notification"in window)){ $("reminderStatus").textContent="This browser does not support notifications.";return;}const permission=await Notification.requestPermission();$("reminderStatus").textContent=permission==="granted"?"Reminders enabled. Keep CampusKit open to receive them.": "Notifications were not enabled.";checkReminders();});
setInterval(checkReminders,60000);
displayTasks();renderCalendar();displayDailyQuote();updateTimerDisplay();
window.campuskitSupabase.auth.onAuthStateChange((event,session)=>{if(session?.user)setTimeout(()=>loadAssignments(session.user),0);else if(event==="SIGNED_OUT")clearAssignments();});
(async()=>{const {data,error}=await window.campuskitSupabase.auth.getSession();if(error){alert("Could not check sign-in status. Please refresh.");return;}if(data.session?.user)await loadAssignments(data.session.user);else clearAssignments();})();
