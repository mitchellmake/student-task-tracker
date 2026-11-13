// CAMPUSKIT - PHASE 1
const $ = id => document.getElementById(id);
const taskInput=$("taskInput"), dueDate=$("dueDate"), taskForm=$("taskForm"), taskList=$("taskList"), progress=$("progress");
const courseInput=$("courseInput"), priorityInput=$("priorityInput"), taskSearch=$("taskSearch"), taskSort=$("taskSort"), recurrenceInput=$("recurrenceInput");
let tasks=[], currentUserId=null, assignmentsReady=false, assignmentLoadVersion=0, currentFilter="all";
const palette=["#6B8EBD","#8B78C6","#5D9C83","#D18B55","#C77991","#4C9A9A"];
const priorityRank={High:0,Medium:1,Low:2};
function colourForCourse(course){let hash=0;for(const ch of (course||"General").trim().toLowerCase())hash=(hash*31+ch.charCodeAt(0))>>>0;return palette[hash%palette.length];}
function dateDelta(date){if(!date)return null;const [y,m,d]=date.split("-").map(Number);const due=Date.UTC(y,m-1,d);const [ty,tm,td]=todayString().split("-").map(Number);return Math.round((due-Date.UTC(ty,tm-1,td))/86400000);}
function todayString(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
dueDate.min=todayString();
async function loadAssignments(user){
 const version=++assignmentLoadVersion;currentUserId=user.id;loadStudentProfile(user);assignmentsReady=false;tasks=[];displayTasks();renderCalendar(); migrateLegacyNotes();renderCourses();refreshNoteCourseOptions();
 const {data,error}=await window.campuskitSupabase.from("assignments").select("id,title,due_date,is_completed,created_at,course,course_color,priority,subtasks,recurrence").eq("user_id",user.id).order("created_at",{ascending:true});
 if(version!==assignmentLoadVersion)return;if(error){alert("Could not load assignments: "+error.message);return;}
 tasks=(data||[]).map(r=>({id:r.id,name:r.title,date:r.due_date||"",done:r.is_completed,course:r.course||"General",courseColor:palette.includes(r.course_color)?r.course_color:colourForCourse(r.course),priority:["High","Medium","Low"].includes(r.priority)?r.priority:"Medium",created:r.created_at,subtasks:Array.isArray(r.subtasks)?r.subtasks:[],recurrence:r.recurrence||"none"}));
 const knownCourses=getCourses();tasks.forEach(t=>{if(!knownCourses.some(c=>c.toLowerCase()===t.course.toLowerCase()))knownCourses.push(t.course);});saveCourses(knownCourses);renderCourses();
 assignmentsReady=true;displayTasks();renderCalendar();checkReminders();refreshTimerTaskOptions();renderInsights();
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
  details.append(name,date,meta); const subBox=document.createElement("div");subBox.className="subtask-box";const subTitle=document.createElement("small");subTitle.textContent="Checklist ("+(task.subtasks||[]).filter(s=>s.done).length+"/"+(task.subtasks||[]).length+")";subBox.append(subTitle);const subList=document.createElement("ul");(task.subtasks||[]).forEach((sub,index)=>{const li=document.createElement("li"),lab=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.checked=!!sub.done;cb.addEventListener("change",()=>saveSubtasks(task,task.subtasks.map((s,i)=>i===index?{text:s.text,done:cb.checked}:s)));const tx=document.createElement("span");tx.textContent=sub.text;lab.append(cb,tx);li.append(lab);subList.append(li);});subBox.append(subList);const add=document.createElement("form");add.className="subtask-add";const ai=document.createElement("input");ai.placeholder="Add a checklist step";ai.maxLength=100;ai.required=true;const ab=document.createElement("button");ab.type="submit";ab.textContent="Add";add.append(ai,ab);add.addEventListener("submit",e=>{e.preventDefault();if(ai.value.trim())saveSubtasks(task,[...(task.subtasks||[]),{text:ai.value.trim(),done:false}]);});subBox.append(add);details.append(subBox);
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
 form.addEventListener("submit",async e=>{e.preventDefault();const name=inputs[0].value.trim(),course=inputs[1].value.trim()||"General",date=inputs[2].value;if(!name){alert("Enter an assignment name.");return;}const courseColor=colourForCourse(course);const {error}=await window.campuskitSupabase.from("assignments").update({title:name,course,course_color:courseColor,due_date:date||null,priority:priority.value}).eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not save changes: "+error.message);return;}Object.assign(task,{name,course,date,courseColor,priority:priority.value});ensureCourse(course);displayTasks();renderCalendar();});item.append(form);
}
async function saveSubtasks(task,next){const {error}=await window.campuskitSupabase.from("assignments").update({subtasks:next}).eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not save checklist: "+error.message);return;}task.subtasks=next;displayTasks();}
async function createRecurringCopy(task){const d=new Date((task.date||todayString())+"T12:00:00");d.setDate(d.getDate()+(task.recurrence==="daily"?1:7));const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");const {data,error}=await window.campuskitSupabase.from("assignments").insert({user_id:currentUserId,title:task.name,due_date:date,is_completed:false,course:task.course,course_color:task.courseColor,priority:task.priority,recurrence:task.recurrence,subtasks:[]}).select("id,title,due_date,is_completed,created_at,course,course_color,priority,subtasks,recurrence").single();if(error){alert("Completed, but next repeat could not be created: "+error.message);return;}tasks.push({id:data.id,name:data.title,date:data.due_date,done:false,course:data.course,courseColor:data.course_color,priority:data.priority,created:data.created_at,subtasks:[],recurrence:data.recurrence});}
async function setCompleted(task){if(!currentUserId||!assignmentsReady)return;const next=!task.done;const {error}=await window.campuskitSupabase.from("assignments").update({is_completed:next,completed_at:next?new Date().toISOString():null}).eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not update assignment: "+error.message);return;}task.done=next;if(next&&task.recurrence&&task.recurrence!=="none")await createRecurringCopy(task);displayTasks();renderCalendar();refreshTimerTaskOptions();}
async function deleteTask(task){if(!currentUserId||!assignmentsReady||!confirm("Delete this assignment?"))return;const {error}=await window.campuskitSupabase.from("assignments").delete().eq("id",task.id).eq("user_id",currentUserId);if(error){alert("Could not delete assignment: "+error.message);return;}tasks=tasks.filter(t=>t.id!==task.id);displayTasks();renderCalendar();}
taskForm.addEventListener("submit",async e=>{e.preventDefault();const name=taskInput.value.trim(),date=dueDate.value,course=courseInput.value.trim()||"General",priority=priorityInput.value,courseColor=colourForCourse(course);if(!name){alert("Please enter an assignment name.");return;}if(date&&date<todayString()){alert("Please choose today or a future deadline.");return;}if(!currentUserId||!assignmentsReady){alert("Your assignments are still loading. Please try again.");return;}const {data,error}=await window.campuskitSupabase.from("assignments").insert({user_id:currentUserId,title:name,due_date:date||null,is_completed:false,course,course_color:courseColor,priority,recurrence:recurrenceInput.value,subtasks:[]}).select("id,title,due_date,is_completed,created_at,course,course_color,priority,subtasks,recurrence").single();if(error){alert("Could not save assignment: "+error.message);return;}tasks.push({id:data.id,name:data.title,date:data.due_date||"",done:data.is_completed,course:data.course,courseColor:data.course_color,priority:data.priority,created:data.created_at,subtasks:[],recurrence:data.recurrence||"none"});ensureCourse(course);refreshTimerTaskOptions();taskInput.value="";dueDate.value="";courseInput.value="";priorityInput.value="Medium";recurrenceInput.value="none";displayTasks();renderCalendar();});
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
let remainingSeconds=1500,timerInterval=null,timerMode="focus";const timerDisplay=$("timerDisplay"),timerStatus=$("timerStatus"),startTimer=$("startTimer");
function updateTimerDisplay(){timerDisplay.textContent=String(Math.floor(remainingSeconds/60)).padStart(2,"0")+":"+String(remainingSeconds%60).padStart(2,"0");}
startTimer.addEventListener("click",()=>{if(timerInterval){clearInterval(timerInterval);timerInterval=null;startTimer.textContent="Resume";timerStatus.textContent="PAUSED";return;}if(remainingSeconds<=0)return;startTimer.textContent="Pause";timerStatus.textContent="FOCUSING";timerInterval=setInterval(()=>{remainingSeconds--;updateTimerDisplay();if(remainingSeconds<=0){clearInterval(timerInterval);timerInterval=null;finishFocusSession();startTimer.textContent="Start again";timerStatus.textContent=timerMode==="break"?"BREAK TIME":"SESSION COMPLETE";if("Notification"in window&&Notification.permission==="granted")new Notification("CampusKit",{body:"Your timer session is complete!"});}},1000);});
$("resetTimer").addEventListener("click",()=>{clearInterval(timerInterval);timerInterval=null;timerMode="focus";remainingSeconds=(Number($("focusLength").value)||25)*60;updateTimerDisplay();startTimer.textContent="Start";timerStatus.textContent="READY TO FOCUS";});
const studyNotes=$("studyNotes"),notesStatus=$("notesStatus"),noteCourse=$("noteCourse");
let activeNoteCourse="General";
function notesStorageKey(course){return "campuskit:notes:"+currentUserId+":"+encodeURIComponent(course);}
function loadCourseNotes(){if(!currentUserId)return;activeNoteCourse=noteCourse.value||"General";studyNotes.value=localStorage.getItem(notesStorageKey(activeNoteCourse))||"";notesStatus.textContent="Notes saved on this device for "+activeNoteCourse+".";}
noteCourse.addEventListener("change",loadCourseNotes);
studyNotes.addEventListener("input",()=>{if(!currentUserId){notesStatus.textContent="Sign in to save notes to your student account on this device.";return;}try{localStorage.setItem(notesStorageKey(activeNoteCourse),studyNotes.value);notesStatus.textContent="Saved under "+activeNoteCourse+" on this device.";}catch{notesStatus.textContent="Unable to save. Check device storage."; }});
const themeToggle=$("themeToggle");function setTheme(mode){document.body.classList.toggle("dark-mode",mode==="dark");themeToggle.textContent=mode==="dark"?"☀️":"🌙";themeToggle.setAttribute("aria-label",mode==="dark"?"Switch to light mode":"Switch to dark mode");localStorage.setItem("campuskitTheme",mode);}setTheme(localStorage.getItem("campuskitTheme")||"light");themeToggle.addEventListener("click",()=>setTheme(document.body.classList.contains("dark-mode")?"light":"dark"));
const reminderLogKey=()=>`campuskitReminders:${currentUserId||"guest"}`;function checkReminders(){if(!("Notification"in window)||Notification.permission!=="granted"||!currentUserId)return;const now=new Date(),log=JSON.parse(localStorage.getItem(reminderLogKey())||"{}");tasks.filter(t=>!t.done&&t.date).forEach(t=>{const [y,m,d]=t.date.split("-").map(Number);const due=new Date(y,m-1,d,9,0,0);[["day",86400000],["hour",3600000]].forEach(([kind,offset])=>{const target=due.getTime()-offset;if(now.getTime()>=target&&now.getTime()<target+60000&&!log[t.id+":"+kind]){new Notification("CampusKit deadline reminder",{body:`${t.name} (${t.course}) is due ${kind==="day"?"tomorrow":"in about one hour"}.`});log[t.id+":"+kind]=true;}});});localStorage.setItem(reminderLogKey(),JSON.stringify(log));}
$("enableReminders").addEventListener("click",async()=>{if(!("Notification"in window)){ $("reminderStatus").textContent="This browser does not support notifications.";return;}const permission=await Notification.requestPermission();$("reminderStatus").textContent=permission==="granted"?"Reminders enabled. Keep CampusKit open to receive them.": "Notifications were not enabled.";checkReminders();});
setInterval(checkReminders,60000);
displayTasks();renderCalendar();displayDailyQuote();updateTimerDisplay();
window.campuskitSupabase.auth.onAuthStateChange((event,session)=>{if(session?.user)setTimeout(()=>loadAssignments(session.user),0);else if(event==="SIGNED_OUT")clearAssignments();});
(async()=>{const {data,error}=await window.campuskitSupabase.auth.getSession();if(error){alert("Could not check sign-in status. Please refresh.");return;}if(data.session?.user)await loadAssignments(data.session.user);else clearAssignments();})();

/* Phase 2: exam dates, grade planning and focus analytics */
const localKey=n=>"campuskit:"+n+":"+(currentUserId||"guest");
function readLocal(n){try{return JSON.parse(localStorage.getItem(localKey(n))||"[]");}catch{return [];}}
function writeLocal(n,v){localStorage.setItem(localKey(n),JSON.stringify(v));}
/* Phase 3: course workspace and portable backup */
function profileStorageKey(){return "campuskit:profile:"+currentUserId;}
function loadStudentProfile(user){
 const form=$("profileForm");if(!form||!currentUserId)return;
 let profile={};try{profile=JSON.parse(localStorage.getItem(profileStorageKey())||"{}");}catch{}
 $("profileName").value=profile.name||user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split("@")[0]||"";
 $("profileUniversity").value=profile.university||"";$("profileProgramme").value=profile.programme||"";$("profileYear").value=profile.year||"";
 $("profileStatus").textContent="Saved on this device.";
}
$("profileForm").addEventListener("submit",e=>{
 e.preventDefault();if(!currentUserId)return;
 const profile={name:$("profileName").value.trim(),university:$("profileUniversity").value.trim(),programme:$("profileProgramme").value.trim(),year:$("profileYear").value};
 if(!profile.name){$("profileStatus").textContent="Please enter your name.";return;}
 try{localStorage.setItem(profileStorageKey(),JSON.stringify(profile));$("profileStatus").textContent="Profile saved on this device.";$("welcomeGreeting").textContent="Hello, "+profile.name.trim().split(/\s+/)[0];}
 catch{$("profileStatus").textContent="Could not save. Check this device's browser storage.";}
});
function courseStorageKey(){return "campuskit:courses:"+currentUserId;}
function getCourses(){if(!currentUserId)return ["General"];try{const list=JSON.parse(localStorage.getItem(courseStorageKey())||'["General"]');return [...new Set(["General",...(Array.isArray(list)?list.filter(x=>typeof x==="string"&&x.trim()):[])])];}catch{return ["General"];}}
function saveCourses(list){if(currentUserId)localStorage.setItem(courseStorageKey(),JSON.stringify([...new Set(["General",...list.filter(Boolean)])]));}
function ensureCourse(course){const list=getCourses();if(course&& !list.some(x=>x.toLowerCase()===course.toLowerCase())){list.push(course);saveCourses(list);}renderCourses();}
function renderCourses(){const list=$("courseList");if(!list||!currentUserId)return;list.replaceChildren();const courses=getCourses();courses.forEach(course=>{const li=document.createElement("li"),name=document.createElement("span"),colour=document.createElement("span");name.textContent=course;colour.className="course-swatch";colour.style.backgroundColor=colourForCourse(course);const left=document.createElement("span");left.className="course-list-name";left.append(colour,name);li.append(left);if(course!=="General"){const del=document.createElement("button");del.type="button";del.className="mini-button";del.textContent="Remove";del.addEventListener("click",()=>{if(!confirm("Remove "+course+" from your course list? Existing assignments and notes will be kept."))return;saveCourses(getCourses().filter(x=>x!==course));renderCourses();refreshNoteCourseOptions();});li.append(del);}list.append(li);});refreshNoteCourseOptions();}
function refreshNoteCourseOptions(){if(!noteCourse||!currentUserId)return;const previous=activeNoteCourse;noteCourse.replaceChildren();getCourses().forEach(course=>noteCourse.append(new Option(course,course)));noteCourse.value=getCourses().includes(previous)?previous:"General";loadCourseNotes();}
$("courseForm").addEventListener("submit",e=>{e.preventDefault();const name=$("courseName").value.trim();if(!name)return;if(getCourses().some(x=>x.toLowerCase()===name.toLowerCase())){alert("That course is already on your list.");return;}saveCourses([...getCourses(),name]);$("courseName").value="";renderCourses();});
function migrateLegacyNotes(){if(!currentUserId)return;const legacy=localStorage.getItem("campuskitNotes"),generalKey=notesStorageKey("General");if(legacy!==null&&localStorage.getItem(generalKey)===null){localStorage.setItem(generalKey,legacy);localStorage.removeItem("campuskitNotes");}}
function exportCampusKitBackup(){
 if(!currentUserId||!assignmentsReady){$("backupStatus").textContent="Please wait until your assignments have loaded.";return;}
 const rows=[["Record type","Name","Course","Due date","Completed","Priority","Repeat","Notes","Date","Minutes","Preference"]];
 const clean=v=>v==null?"":String(v).replace(/\r?\n/g," ");
 tasks.forEach(t=>rows.push(["Assignment",clean(t.name),clean(t.course),clean(t.date),t.done?"Yes":"No",clean(t.priority),clean(t.recurrence)]));
 getCourses().forEach(course=>rows.push(["Course","",clean(course)]));
 getCourses().forEach(course=>{const note=localStorage.getItem(notesStorageKey(course))||"";if(note)rows.push(["Study note","",clean(course),"","","","",clean(note)]);});
 readLocal("exams").forEach(x=>rows.push(["Exam",clean(x.name),"",clean(x.date)]));
 readLocal("focusRecords").forEach(x=>rows.push(["Focus session","",clean(x.course),"","","","", "",clean(x.date),clean(x.minutes)]));
 rows.push(["Preference","","","","","","","","","","Theme: "+clean(localStorage.getItem("campuskitTheme")||"light")]);
 const csv=rows.map(row=>row.map(value=>{const s=clean(value);return '"'+s.replace(/"/g,'""')+'"';}).join(",")).join("\r\n");
 const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="campuskit-backup-"+todayString()+".csv";document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
 $("backupStatus").textContent="CSV backup downloaded. Open it with Excel or Google Sheets.";
}

$("exportBackup").addEventListener("click",exportCampusKitBackup);
function parseBackupCSV(text){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===","){row.push(field);field="";}
  else if(ch==="\\n"){row.push(field);rows.push(row);row=[];field="";}
  else if(ch!=="\\r")field+=ch;
 }
 if(field.length||row.length){row.push(field);rows.push(row);}
 return rows;
}
$("importBackup").addEventListener("click",()=>{$("backupFile").click();});
$("backupFile").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 const status=$("backupStatus");
 if(!currentUserId||!assignmentsReady){status.textContent="Sign in and wait for assignments to load first.";e.target.value="";return;}
 try{
  const text=await file.text(),rows=parseBackupCSV(text.replace(/^\\uFEFF/,""));
  const expected=["Record type","Name","Course","Due date","Completed","Priority","Repeat","Notes","Date","Minutes","Preference"];
  if(!rows.length||expected.some((v,i)=>rows[0]?.[i]!==v))throw new Error("This file is not a CampusKit CSV backup.");
  const imported=rows.slice(1).filter(r=>r.some(v=>v!==""));
  const assignmentRows=imported.filter(r=>r[0]==="Assignment"&&r[1]?.trim()).map(r=>({
   user_id:currentUserId,title:r[1].trim(),course:r[2]?.trim()||"General",
   due_date:/^\\d{4}-\\d{2}-\\d{2}$/.test(r[3]||"")?r[3]:null,
   is_completed:r[4]==="Yes",priority:["High","Medium","Low"].includes(r[5])?r[5]:"Medium",
   recurrence:["daily","weekly"].includes(r[6])?r[6]:"none",subtasks:[]
  }));
  if(!imported.length)throw new Error("The backup contains no records to restore.");
  if(!confirm("Restore this backup by adding its records to your current CampusKit account? Existing records will not be deleted.")){e.target.value="";return;}
  if(assignmentRows.length){
   const {error}=await window.campuskitSupabase.from("assignments").insert(assignmentRows);
   if(error)throw new Error("Assignments could not be restored: "+error.message);
  }
  const courses=[...getCourses()];
  imported.filter(r=>r[0]==="Course"&&r[2]?.trim()).forEach(r=>courses.push(r[2].trim()));
  saveCourses(courses);
  imported.filter(r=>r[0]==="Study note"&&r[2]).forEach(r=>{
   const key=notesStorageKey(r[2]);const old=localStorage.getItem(key)||"";
   if(r[7]&&!old)localStorage.setItem(key,r[7]);
  });
  const exams=readLocal("exams");
  imported.filter(r=>r[0]==="Exam"&&r[1]?.trim()&&/^\\d{4}-\\d{2}-\\d{2}$/.test(r[3]||""))
   .forEach(r=>{if(!exams.some(x=>x.name===r[1]&&x.date===r[3]))exams.push({name:r[1],date:r[3]});});
  writeLocal("exams",exams);
  const focus=readLocal("focusRecords");
  imported.filter(r=>r[0]==="Focus session"&&r[9]&&Number(r[9])>0)
   .forEach(r=>focus.push({course:r[2]||"General",date:r[8]||todayString(),minutes:Number(r[9])}));
  writeLocal("focusRecords",focus);
  const pref=imported.find(r=>r[0]==="Preference")?.[10]||"";
  if(pref.startsWith("Theme: "))setTheme(pref.slice(7)==="dark"?"dark":"light");
  renderCourses();refreshNoteCourseOptions();renderExams();renderInsights();
  const {data}=await window.campuskitSupabase.auth.getUser();if(data?.user)await loadAssignments(data.user);
  status.textContent="Restore complete: "+assignmentRows.length+" assignments imported. Existing records were kept.";
 }catch(err){status.textContent=err.message||"Could not restore this backup.";}
 e.target.value="";
});

function renderExams(){const list=$("examList");if(!list)return;list.replaceChildren();const exams=readLocal("exams").sort((a,b)=>a.date.localeCompare(b.date));if(!exams.length){const li=document.createElement("li");li.textContent="No exams added yet.";list.append(li);return;}exams.forEach((x,i)=>{const li=document.createElement("li"),name=document.createElement("span"),count=document.createElement("small"),del=document.createElement("button");const days=Math.ceil((new Date(x.date+"T00:00:00")-new Date(todayString()+"T00:00:00"))/86400000);name.textContent=x.name;count.textContent=days<0?"Date passed":days===0?"Today":days+" days left";del.className="mini-button";del.textContent="Remove";del.addEventListener("click",()=>{const a=readLocal("exams");a.splice(i,1);writeLocal("exams",a);renderExams();});li.append(name,count,del);list.append(li);});}
$("examForm").addEventListener("submit",e=>{e.preventDefault();const name=$("examName").value.trim(),date=$("examDate").value;if(!name||!date)return;const a=readLocal("exams");a.push({name,date});writeLocal("exams",a);e.target.reset();renderExams();});$("examDate").min=todayString();renderExams();
$("gradeForm").addEventListener("submit",e=>{e.preventDefault();const c=Number($("gradeCurrent").value),w=Number($("gradeWeight").value)/100,t=Number($("gradeTarget").value);if(w<=0||w>1||c<0||c>100||t<0||t>100){$("gradeResult").textContent="Enter valid percentages between 0 and 100.";return;}const need=(t-c*(1-w))/w;$("gradeResult").textContent=need>100?"This target would require more than 100% on the final.":need<0?"You have already exceeded that target in this estimate.":"You need approximately "+need.toFixed(1)+"% on the final in "+$("gradeCourse").value.trim()+".";});
function focusRecords(){return readLocal("focusRecords");}
function renderInsights(){const records=focusRecords(),week=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);week.push([d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"));} $("focusTotal").textContent=records.reduce((s,r)=>s+r.minutes,0);$("weeklySessions").textContent=records.filter(r=>week.includes(r.date)).length;let streak=0;for(let i=0;i<365;i++){const d=new Date();d.setDate(d.getDate()-i);const k=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");if(records.some(r=>r.date===k))streak++;else if(i>0)break;} $("studyStreak").textContent=streak;const chart=$("weeklyChart");chart.replaceChildren();const vals=week.map(day=>records.filter(r=>r.date===day).reduce((s,r)=>s+r.minutes,0)),max=Math.max(25,...vals);week.forEach((day,i)=>{const col=document.createElement("div"),bar=document.createElement("span"),label=document.createElement("small"),value=document.createElement("small");col.className="chart-day";bar.className="chart-bar";bar.style.height=(vals[i]/max*90+3)+"px";label.textContent=new Date(day+"T12:00:00").toLocaleDateString("en",{weekday:"short"});value.textContent=vals[i]+"m";col.append(value,bar,label);chart.append(col);});const by={};records.forEach(r=>by[r.course]=(by[r.course]||0)+r.minutes);const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];$("courseInsights").textContent=top?"Most focus time: "+top[0]+" ("+top[1]+" minutes).":"Complete focus sessions to build your study insights.";}
function refreshTimerTaskOptions(){const s=$("timerTask");if(!s)return;const v=s.value;s.replaceChildren(new Option("Choose assignment",""));tasks.filter(t=>!t.done).forEach(t=>s.append(new Option(t.name,t.id)));s.value=v;}
function finishFocusSession(){if(timerMode==="focus"){const minutes=Number($("focusLength").value)||25,task=tasks.find(t=>t.id===$("timerTask").value),records=focusRecords();records.push({date:todayString(),minutes:minutes,course:task?task.course:"General"});writeLocal("focusRecords",records);renderInsights();try{const C=window.AudioContext||window.webkitAudioContext;if(C){const c=new C(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=660;g.gain.value=.07;o.start();o.stop(c.currentTime+.35);}}catch(e){}timerMode="break";remainingSeconds=(Number($("breakLength").value)||5)*60;}else{timerMode="focus";remainingSeconds=(Number($("focusLength").value)||25)*60;}updateTimerDisplay();}
$("focusLength").addEventListener("change",()=>{if(!timerInterval&&timerMode==="focus"){remainingSeconds=Number($("focusLength").value)*60;updateTimerDisplay();}});$("breakLength").addEventListener("change",()=>{if(!timerInterval&&timerMode==="break"){remainingSeconds=Number($("breakLength").value)*60;updateTimerDisplay();}});
renderInsights();refreshTimerTaskOptions();

/* CampusKit install prompt and offline app shell */
let campusKitInstallPrompt=null;
const installAppButton=document.getElementById("installAppButton");
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();campusKitInstallPrompt=event;if(installAppButton)installAppButton.hidden=false;
});
installAppButton?.addEventListener("click",async()=>{
 if(!campusKitInstallPrompt)return;
 campusKitInstallPrompt.prompt();
 await campusKitInstallPrompt.userChoice;
 campusKitInstallPrompt=null;installAppButton.hidden=true;
});
window.addEventListener("appinstalled",()=>{if(installAppButton)installAppButton.hidden=true;});
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(error=>console.warn("CampusKit offline setup unavailable:",error)));}
