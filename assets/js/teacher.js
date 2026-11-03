
document.addEventListener("DOMContentLoaded", async function () {

    const SUPABASE_URL = "https://tmplfykqfhvwgfoavjlx.supabase.co";
    const SUPABASE_KEY = "sb_publishable_3GfaeEPt1nf-nWOGW1XCVw_8GOEe_0D";

    if (!window.supabase) {
        console.error("Supabase library is not loaded.");
        alert("Unable to connect to the database.");
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    let currentUser = null;
    let teacherClasses = [];
    let students = [];
    let classMap = new Map();

    const setText = function (id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    };

    function showStudentMessage(message) {
        const table = document.getElementById("teacherStudentList");

        if (!table) return;

        table.innerHTML = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.className = "student-directory-empty";
        cell.textContent = message;

        row.appendChild(cell);
        table.appendChild(row);
    }

    function showClassMessage(message) {
        const container = document.getElementById("teacherAssignedClasses");

        if (!container) return;

        container.innerHTML = "";

        const messageElement = document.createElement("div");
        messageElement.className = "teacher-class-empty";
        messageElement.textContent = message;

        container.appendChild(messageElement);
    }

    function getInitials(name) {
        return (name || "Teacher")
            .trim()
            .split(/\s+/)
            .map(word => word.charAt(0))
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }

    function getClassLabel(classData) {
        return `Class ${classData.class_name} - Section ${classData.section}`;
    }

    // ==========================================
    // TEACHER PROFILE
    // ==========================================

    function renderTeacherProfile() {

        const teacherName = currentUser.name || "Teacher";

        setText("teacherName", teacherName);
        setText("sidebarTeacherName", teacherName);
        setText("profileTeacherName", teacherName);
        setText("profileTeacherEmail", currentUser.email || "Not available");
        setText("profileTeacherDepartment", currentUser.department || "Not assigned");

        const initials = getInitials(teacherName);

        setText("teacherAvatar", initials);
        setText("topTeacherAvatar", initials);

        setText(
            "currentDate",
            new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
            })
        );
    }

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    async function initializeTeacher() {

        let storedUser = null;

        try {
            storedUser = JSON.parse(
                localStorage.getItem("smartsphereUser")
            );
        } catch (error) {
            console.error("Unable to read saved session:", error);
        }

        if (!storedUser || storedUser.role !== "teacher") {
            window.location.href = "index.html";
            return false;
        }

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError || !sessionData.session) {
            localStorage.removeItem("smartsphereUser");
            window.location.href = "index.html";
            return false;
        }

        const authUser = sessionData.session.user;

        if (storedUser.id !== authUser.id) {
            await supabaseClient.auth.signOut();
            localStorage.removeItem("smartsphereUser");
            window.location.href = "index.html";
            return false;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("id, name, email, role, department, status")
                .eq("id", authUser.id)
                .single();

        if (profileError || !profile) {
            console.error("Profile loading error:", profileError);
            alert("Unable to load teacher profile.");
            return false;
        }

        if (profile.role !== "teacher" || profile.status !== "active") {
            await supabaseClient.auth.signOut();
            localStorage.removeItem("smartsphereUser");
            window.location.href = "index.html";
            return false;
        }

        currentUser = profile;

        localStorage.setItem(
            "smartsphereUser",
            JSON.stringify(profile)
        );

        renderTeacherProfile();

        return true;
    }

    // ==========================================
    // LOAD TEACHER ALLOCATIONS
    // ==========================================

    async function loadTeacherAllocations() {

        showClassMessage("Loading assigned classes...");

        const { data: allocations, error: allocationError } =
            await supabaseClient
                .from("teacher_allocations")
                .select("id, teacher_id, class_id, subject, created_at")
                .eq("teacher_id", currentUser.id)
                .order("created_at", { ascending: true });

        if (allocationError) {
            console.error("Allocation loading error:", allocationError);
            showClassMessage("Unable to load assigned classes.");
            return;
        }

        if (!allocations || allocations.length === 0) {

            teacherClasses = [];
            students = [];
            classMap.clear();

            showClassMessage(
                "No classes have been assigned to you yet. Please contact the administrator."
            );

            renderClassFilter();
            renderStudents();
            updateStatistics();

            return;
        }

        const classIds = [
            ...new Set(allocations.map(item => item.class_id))
        ];

        const { data: classRows, error: classError } =
            await supabaseClient
                .from("classes")
                .select("id, class_name, section, academic_year")
                .in("id", classIds);

        if (classError) {
            console.error("Class loading error:", classError);
            showClassMessage("Unable to load class details.");
            return;
        }

        classMap = new Map(
            (classRows || []).map(classData => [
                classData.id,
                classData
            ])
        );

        teacherClasses = allocations
            .filter(allocation => classMap.has(allocation.class_id))
            .map(allocation => ({
                ...allocation,
                classData: classMap.get(allocation.class_id)
            }));

        renderAssignedClasses();

        await loadAssignedStudents();
    }

    // ==========================================
    // DISPLAY ASSIGNED CLASSES
    // ==========================================

    function renderAssignedClasses() {

        const container = document.getElementById("teacherAssignedClasses");

        if (!container) return;

        container.innerHTML = "";

        const groupedClasses = new Map();

        teacherClasses.forEach(function (allocation) {

            const classId = allocation.class_id;

            if (!groupedClasses.has(classId)) {
                groupedClasses.set(classId, {
                    classData: allocation.classData,
                    subjects: []
                });
            }

            const group = groupedClasses.get(classId);

            if (!group.subjects.includes(allocation.subject)) {
                group.subjects.push(allocation.subject);
            }
        });

        if (groupedClasses.size === 0) {
            showClassMessage("No valid assigned classes found.");
            return;
        }

        let index = 0;

        groupedClasses.forEach(function (group) {

            const card = document.createElement("div");
            card.className = "teacher-class-item";

            const icon = document.createElement("div");
            icon.className = "teacher-subject-icon";
            icon.textContent = group.subjects[0]
                .substring(0, 2)
                .toUpperCase();

            const info = document.createElement("div");
            info.className = "teacher-class-info";

            const heading = document.createElement("h3");
            heading.textContent = getClassLabel(group.classData);

            const subjectText = document.createElement("p");
            subjectText.textContent =
                "Subjects: " + group.subjects.join(", ");

            info.appendChild(heading);
            info.appendChild(subjectText);

            const studentCount = students.filter(
                student => student.class_id === group.classData.id
            ).length;

            const count = document.createElement("span");
            count.className = "teacher-student-count";
            count.textContent = `${studentCount} Students`;

            card.appendChild(icon);
            card.appendChild(info);
            card.appendChild(count);

            container.appendChild(card);

            index++;
        });
    }

    // ==========================================
    // LOAD STUDENTS FROM ASSIGNED CLASSES
    // ==========================================

    async function loadAssignedStudents() {

        const assignedClassIds = [
            ...new Set(teacherClasses.map(item => item.class_id))
        ];

        if (assignedClassIds.length === 0) {
            students = [];
            renderClassFilter();
            renderStudents();
            updateStatistics();
            return;
        }

        showStudentMessage("Loading students...");

        const { data: studentRows, error: studentError } =
            await supabaseClient
                .from("profiles")
                .select("id, name, email, student_id, class_id, status")
                .eq("role", "student")
                .eq("status", "active")
                .in("class_id", assignedClassIds)
                .order("name", { ascending: true });

        if (studentError) {
            console.error("Student loading error:", studentError);
            showStudentMessage("Unable to load students.");
            return;
        }

        students = (studentRows || []).map(student => ({
            ...student,
            classData: classMap.get(student.class_id)
        }));

        renderClassFilter();
        renderStudents();
        updateStatistics();
        renderAssignedClasses();
    }

    // ==========================================
    // STUDENT CLASS LABEL
    // ==========================================

    function getStudentClass(student) {

        if (!student.classData) {
            return "Not assigned";
        }

        return getClassLabel(student.classData);
    }

    function getStudentId(student) {
        return student.student_id || "Not assigned";
    }

    // ==========================================
    // CLASS FILTER
    // ==========================================

    function renderClassFilter() {

        const classFilter = document.getElementById("studentClassFilter");

        if (!classFilter) return;

        const selectedClass = classFilter.value;

        classFilter.innerHTML =
            '<option value="">All Assigned Classes</option>';

        const uniqueClasses = new Map();

        teacherClasses.forEach(function (allocation) {
            uniqueClasses.set(
                allocation.class_id,
                allocation.classData
            );
        });

        uniqueClasses.forEach(function (classData, classId) {

            const option = document.createElement("option");

            option.value = classId;
            option.textContent = getClassLabel(classData);

            classFilter.appendChild(option);
        });

        if (uniqueClasses.has(selectedClass)) {
            classFilter.value = selectedClass;
        }
    }

    // ==========================================
    // DISPLAY STUDENTS
    // ==========================================

    function renderStudents() {

        const studentTable = document.getElementById("teacherStudentList");

        if (!studentTable) return;

        const studentSearch = document.getElementById("studentSearch");
        const classFilter = document.getElementById("studentClassFilter");

        const searchText = studentSearch
            ? studentSearch.value.trim().toLowerCase()
            : "";

        const selectedClass = classFilter
            ? classFilter.value
            : "";

        const filteredStudents = students.filter(function (student) {

            const name = (student.name || "").toLowerCase();
            const email = (student.email || "").toLowerCase();
            const studentId = String(getStudentId(student)).toLowerCase();

            const matchesSearch =
                name.includes(searchText) ||
                email.includes(searchText) ||
                studentId.includes(searchText);

            const matchesClass =
                !selectedClass || student.class_id === selectedClass;

            return matchesSearch && matchesClass;
        });

        studentTable.innerHTML = "";

        if (filteredStudents.length === 0) {

            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.className = "student-directory-empty";

            cell.textContent = students.length === 0
                ? "No students found in your assigned classes."
                : "No students match your search.";

            row.appendChild(cell);
            studentTable.appendChild(row);

            return;
        }

        filteredStudents.forEach(function (student) {

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.className = "student-name-cell";
            nameCell.textContent = student.name || "Unnamed Student";

            const idCell = document.createElement("td");
            idCell.textContent = getStudentId(student);

            const emailCell = document.createElement("td");
            emailCell.textContent = student.email || "Not available";

            const classCell = document.createElement("td");

            const classBadge = document.createElement("span");
            classBadge.className = "student-class-badge";
            classBadge.textContent = getStudentClass(student);

            classCell.appendChild(classBadge);

            row.appendChild(nameCell);
            row.appendChild(idCell);
            row.appendChild(emailCell);
            row.appendChild(classCell);

            studentTable.appendChild(row);
        });
    }

    // ==========================================
    // UPDATE STATISTICS
    // ==========================================

    function updateStatistics() {

        const uniqueClasses = new Set(
            teacherClasses.map(item => item.class_id)
        );

        setText("totalTeacherStudents", students.length);
        setText("studentCount", students.length + " Students");
        setText("totalTeacherClasses", uniqueClasses.size);
        setText("myClassesLabel", uniqueClasses.size + " Classes");
    }

    // ==========================================
    // SEARCH AND FILTER
    // ==========================================

    const studentSearch = document.getElementById("studentSearch");
    const classFilter = document.getElementById("studentClassFilter");

    if (studentSearch) {
        studentSearch.addEventListener("input", renderStudents);
    }

    if (classFilter) {
        classFilter.addEventListener("change", renderStudents);
    }

    // ==========================================
    // REFRESH
    // ==========================================

    window.addEventListener("focus", function () {

        if (currentUser) {
            loadTeacherAllocations();
        }
    });

    // ==========================================
    // LOGOUT
    // ==========================================

    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {

        logoutButton.addEventListener("click", async function () {

            logoutButton.disabled = true;

            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                console.error("Logout error:", error);
            }

            localStorage.removeItem("smartsphereUser");

            window.location.href = "index.html";
        });
    }

    // ==========================================
    // START DASHBOARD
    // ==========================================

    try {
        const initialized = await initializeTeacher();

        if (initialized) {
            await loadTeacherAllocations();
        }
    } catch (error) {
        console.error("Teacher dashboard error:", error);
        showClassMessage("Unable to initialize teacher dashboard.");
        showStudentMessage("Unable to load student records.");
    }

});
