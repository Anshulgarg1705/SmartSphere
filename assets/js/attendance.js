
(function () {
    "use strict";

    const SUPABASE_URL = "https://tmplfykqfhvwgfoavjlx.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3GfaeEPt1nf-nWOGW1XCVw_8GOEe_0D";

    let supabaseClient;
    let currentUser;
    let currentProfile;
    let classes = [];
    let students = [];
    let attendanceRecords = [];
    let attendanceMap = {};
    let selectedClassId = "";
    let selectedDate = "";

    const $ = id => document.getElementById(id);

    function getLocalDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function showMessage(message, type = "info") {
        const element = $("attendanceMessage");

        if (!element) {
            alert(message);
            return;
        }

        element.textContent = message;
        element.style.display = "block";
        element.style.padding = "12px 15px";
        element.style.marginTop = "12px";
        element.style.borderRadius = "8px";
        element.style.fontSize = "13px";

        if (type === "error") {
            element.style.background = "#fee2e2";
            element.style.color = "#991b1b";
        } else if (type === "success") {
            element.style.background = "#dcfce7";
            element.style.color = "#166534";
        } else {
            element.style.background = "#eff6ff";
            element.style.color = "#1d4ed8";
        }
    }

    function clearMessage() {
        const element = $("attendanceMessage");

        if (element) {
            element.textContent = "";
            element.style.display = "none";
        }
    }

    function getInitials(name) {
        return String(name || "User")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(word => word[0])
            .join("")
            .toUpperCase();
    }

    function getClassLabel(classId) {
        const item = classes.find(record => record.id === classId);

        return item
            ? `${item.class_name} - ${item.section}`
            : "Unassigned";
    }

    function formatDate(value) {
        if (!value) return "—";

        return new Date(value + "T00:00:00").toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function setVisibility(id, visible) {
        const element = $(id);
        if (element) element.hidden = !visible;
    }

    function createCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value ?? "—";
        row.appendChild(cell);
        return cell;
    }

    function normalizeStatus(status) {
        const value = String(status || "").trim().toLowerCase();

        if (["present", "absent", "late"].includes(value)) {
            return value;
        }

        return "";
    }

    function createStatusBadge(status) {
        const badge = document.createElement("span");
        const normalized = normalizeStatus(status);

        const labels = {
            present: "Present",
            absent: "Absent",
            late: "Late"
        };

        badge.textContent = labels[normalized] || "Not marked";
        badge.style.display = "inline-block";
        badge.style.padding = "6px 10px";
        badge.style.borderRadius = "20px";
        badge.style.fontSize = "12px";
        badge.style.fontWeight = "600";

        if (normalized === "present") {
            badge.style.background = "#dcfce7";
            badge.style.color = "#166534";
        } else if (normalized === "absent") {
            badge.style.background = "#fee2e2";
            badge.style.color = "#991b1b";
        } else if (normalized === "late") {
            badge.style.background = "#fef3c7";
            badge.style.color = "#92400e";
        } else {
            badge.style.background = "#f1f5f9";
            badge.style.color = "#475569";
        }

        return badge;
    }

    function setProfileInformation() {
        const name = currentProfile.name || currentProfile.email || "User";
        const role = currentProfile.role || "User";

        setText("moduleUserName", name);
        setText("moduleUserRole", role);
        setText("moduleAvatar", getInitials(name));

        setText(
            "currentDate",
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            })
        );

        const dashboardLinks = {
            admin: "admin.html",
            teacher: "teacher.html",
            student: "student.html"
        };

        const dashboardLink = $("dashboardLink");

        if (dashboardLink) {
            dashboardLink.href =
                dashboardLinks[String(role).toLowerCase()] || "index.html";
        }

        if (String(role).toLowerCase() === "teacher") {
            setText("welcomeHeading", `Welcome, ${name}`);
            setText(
                "welcomeDescription",
                "Manage your class attendance and keep student records updated."
            );
        } else if (String(role).toLowerCase() === "student") {
            setText("welcomeHeading", `Welcome, ${name}`);
            setText(
                "welcomeDescription",
                "View your attendance records and monitor your attendance percentage."
            );
        } else {
            setText("welcomeHeading", `Welcome, ${name}`);
            setText(
                "welcomeDescription",
                "Monitor attendance records across your institution."
            );
        }
    }

    async function initializeSupabase() {
        if (
            !window.supabase ||
            typeof window.supabase.createClient !== "function"
        ) {
            throw new Error("Supabase library could not be loaded.");
        }

        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );

        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            localStorage.removeItem("smartsphereUser");
            window.location.replace("index.html");
            return false;
        }

        currentUser = data.session.user;

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("id, name, email, role, status, class_id, student_id, teacher_id")
                .eq("id", currentUser.id)
                .single();

        if (profileError) {
            throw new Error(
                "Unable to load your profile: " + profileError.message
            );
        }

        if (
            !profile ||
            String(profile.status || "active").toLowerCase() !== "active"
        ) {
            await supabaseClient.auth.signOut();
            localStorage.removeItem("smartsphereUser");
            window.location.replace("index.html");
            return false;
        }

        currentProfile = profile;

        localStorage.setItem(
            "smartsphereUser",
            JSON.stringify(profile)
        );

        return true;
    }

    async function loadClasses() {
        const { data, error } = await supabaseClient
            .from("classes")
            .select("id, class_name, section, academic_year")
            .order("class_name")
            .order("section");

        if (error) {
            throw new Error("Unable to load classes: " + error.message);
        }

        const allClasses = data || [];
        const role = String(currentProfile.role).toLowerCase();

        if (role === "teacher") {
            const { data: allocations, error: allocationError } =
                await supabaseClient
                    .from("teacher_allocations")
                    .select("class_id")
                    .eq("teacher_id", currentProfile.id);

            if (allocationError) {
                throw new Error(
                    "Unable to load your class allocations: " +
                    allocationError.message
                );
            }

            const allowedIds = [
                ...new Set((allocations || []).map(item => item.class_id))
            ];

            classes = allClasses.filter(item =>
                allowedIds.includes(item.id)
            );

        } else if (role === "admin") {
            classes = allClasses;

        } else {
            classes = allClasses.filter(
                item => item.id === currentProfile.class_id
            );
        }

        populateClassDropdown();
    }

    function populateClassDropdown() {
        const select = $("classSelect");
        if (!select) return;

        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select Class";
        select.appendChild(placeholder);

        classes.forEach(item => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = `${item.class_name} - ${item.section}`;
            select.appendChild(option);
        });

        if (classes.length === 1) {
            select.value = classes[0].id;
            selectedClassId = classes[0].id;
        } else if (classes.some(item => item.id === selectedClassId)) {
            select.value = selectedClassId;
        }
    }

    async function loadStudents() {
        if (!selectedClassId) {
            students = [];
            renderAttendanceTable();
            return;
        }

        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, name, email, student_id, class_id, status")
            .eq("role", "student")
            .eq("class_id", selectedClassId)
            .order("name");

        if (error) {
            throw new Error("Unable to load students: " + error.message);
        }

        students = (data || []).filter(student =>
            String(student.status || "active").toLowerCase() === "active"
        );
    }

    async function loadAttendanceForDate() {
        attendanceMap = {};

        if (!selectedClassId || !selectedDate) return;

        const { data, error } = await supabaseClient
            .from("attendance")
            .select("id, student_id, class_id, attendance_date, status, marked_by")
            .eq("class_id", selectedClassId)
            .eq("attendance_date", selectedDate);

        if (error) {
            throw new Error("Unable to load attendance: " + error.message);
        }

        (data || []).forEach(record => {
            attendanceMap[record.student_id] = {
                ...record,
                status: normalizeStatus(record.status)
            };
        });
    }

    async function loadTeacherAttendance() {
        clearMessage();

        selectedClassId = $("classSelect")?.value || selectedClassId;
        selectedDate = $("attendanceDate")?.value || getLocalDate();

        if (!selectedClassId) {
            showMessage("Please select a class first.", "info");
            students = [];
            attendanceMap = {};
            renderAttendanceTable();
            updateStatistics();
            return;
        }

        setText("selectedClassHeading", getClassLabel(selectedClassId));

        try {
            await loadStudents();
            await loadAttendanceForDate();

            renderAttendanceTable();
            updateStatistics();
            await loadAttendanceHistory();

            setText("attendanceStatusText", `${students.length} students found`);

        } catch (error) {
            console.error("Attendance loading error:", error);
            showMessage(error.message, "error");
        }
    }

    function renderAttendanceTable() {
        const body = $("attendanceTableBody");
        if (!body) return;

        body.replaceChildren();

        if (students.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent = selectedClassId
                ? "No active students found in this class."
                : "Select a class to view students.";

            row.appendChild(cell);
            body.appendChild(row);
            return;
        }

        students.forEach((student, index) => {
            const row = document.createElement("tr");
            const record = attendanceMap[student.id];
            const status = normalizeStatus(record?.status);

            createCell(row, index + 1);
            createCell(row, student.student_id || "—");
            createCell(row, student.name || "Unknown");

            const statusCell = document.createElement("td");

            if (String(currentProfile.role).toLowerCase() === "teacher") {
                const controls = document.createElement("div");
                controls.style.display = "flex";
                controls.style.flexWrap = "wrap";
                controls.style.gap = "7px";

                const statusOptions = [
                    { value: "present", label: "Present", color: "#16a34a" },
                    { value: "absent", label: "Absent", color: "#dc2626" },
                    { value: "late", label: "Late", color: "#d97706" }
                ];

                statusOptions.forEach(option => {
                    const button = document.createElement("button");

                    button.type = "button";
                    button.textContent = option.label;
                    button.dataset.studentId = student.id;
                    button.dataset.status = option.value;

                    button.style.padding = "7px 11px";
                    button.style.borderRadius = "7px";
                    button.style.border = "1px solid #cbd5e1";
                    button.style.cursor = "pointer";
                    button.style.fontSize = "12px";
                    button.style.fontWeight = "600";

                    if (status === option.value) {
                        button.style.background = option.color;
                        button.style.color = "#fff";
                        button.style.borderColor = option.color;
                    } else {
                        button.style.background = "#fff";
                        button.style.color = "#334155";
                    }

                    button.addEventListener("click", () => {
                        attendanceMap[student.id] = {
                            ...(attendanceMap[student.id] || {}),
                            student_id: student.id,
                            class_id: selectedClassId,
                            attendance_date: selectedDate,
                            status: option.value,
                            marked_by: currentProfile.id
                        };

                        renderAttendanceTable();
                        updateStatistics();
                    });

                    controls.appendChild(button);
                });

                statusCell.appendChild(controls);
            } else {
                statusCell.appendChild(
                    createStatusBadge(status)
                );
            }

            row.appendChild(statusCell);

            createCell(
                row,
                record ? formatDate(record.attendance_date) : "Not marked"
            );

            body.appendChild(row);
        });
    }

    function updateStatistics() {
        let present = 0;
        let absent = 0;
        let late = 0;

        Object.values(attendanceMap).forEach(record => {
            const status = normalizeStatus(record.status);

            if (status === "present") present++;
            if (status === "absent") absent++;
            if (status === "late") late++;
        });

        const total = students.length;
        const marked = present + absent + late;
        const rate = marked > 0
            ? Math.round((present + late) / marked * 100)
            : 0;

        setText("totalStudents", total);
        setText("presentCount", present);
        setText("absentCount", absent);
        setText("attendanceRate", rate + "%");

        if ($("lateCount")) {
            setText("lateCount", late);
        }
    }

    async function saveAttendance() {
        if (String(currentProfile.role).toLowerCase() !== "teacher") {
            showMessage("Only teachers can mark attendance.", "error");
            return;
        }

        if (!selectedClassId || !selectedDate) {
            showMessage("Please select a class and date.", "error");
            return;
        }

        const unmarked = students.filter(student =>
            !normalizeStatus(attendanceMap[student.id]?.status)
        );

        if (unmarked.length > 0) {
            showMessage(
                `Please mark attendance for all ${unmarked.length} remaining student(s).`,
                "error"
            );
            return;
        }

        const button = $("saveAttendanceBtn");

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        try {
            for (const student of students) {
                const record = attendanceMap[student.id];
                const status = normalizeStatus(record.status);

                if (!status) {
                    throw new Error(
                        `Invalid attendance status for ${student.name || "a student"}.`
                    );
                }

                const payload = {
                    student_id: student.id,
                    marked_by: currentProfile.id,
                    class_id: selectedClassId,
                    attendance_date: selectedDate,
                    status: status
                };

                let result;

                if (record.id) {
                    result = await supabaseClient
                        .from("attendance")
                        .update(payload)
                        .eq("id", record.id);
                } else {
                    result = await supabaseClient
                        .from("attendance")
                        .insert(payload)
                        .select("id, student_id, class_id, attendance_date, status, marked_by")
                        .single();
                }

                if (result.error) {
                    throw new Error(result.error.message);
                }

                if (result.data) {
                    attendanceMap[student.id] = {
                        ...result.data,
                        status: normalizeStatus(result.data.status)
                    };
                }
            }

            showMessage(
                "Attendance saved successfully to Supabase.",
                "success"
            );

            await loadTeacherAttendance();

        } catch (error) {
            console.error("Attendance save error:", error);

            showMessage(
                "Unable to save attendance: " + error.message,
                "error"
            );

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Save Attendance";
            }
        }
    }

    function markAll(status) {
        if (String(currentProfile.role).toLowerCase() !== "teacher") return;

        const normalized = normalizeStatus(status);

        if (!normalized) return;

        students.forEach(student => {
            attendanceMap[student.id] = {
                ...(attendanceMap[student.id] || {}),
                student_id: student.id,
                class_id: selectedClassId,
                attendance_date: selectedDate,
                status: normalized,
                marked_by: currentProfile.id
            };
        });

        renderAttendanceTable();
        updateStatistics();
    }

    async function loadStudentAttendance() {
        setVisibility("teacherFilters", false);
        setVisibility("teacherActions", false);
        setVisibility("teacherSaveArea", false);

        setText("panelTitle", "My Attendance");
        setText("panelDescription", "Your personal attendance records.");

        const { data, error } = await supabaseClient
            .from("attendance")
            .select("id, student_id, class_id, attendance_date, status, marked_by")
            .eq("student_id", currentProfile.id)
            .order("attendance_date", { ascending: false })
            .limit(100);

        if (error) {
            throw new Error("Unable to load your attendance: " + error.message);
        }

        attendanceRecords = data || [];

        const present = attendanceRecords.filter(
            item => normalizeStatus(item.status) === "present"
        ).length;

        const absent = attendanceRecords.filter(
            item => normalizeStatus(item.status) === "absent"
        ).length;

        const late = attendanceRecords.filter(
            item => normalizeStatus(item.status) === "late"
        ).length;

        const total = present + absent + late;
        const percentage = total
            ? Math.round((present + late) / total * 100)
            : 0;

        setText("totalStudents", total);
        setText("presentCount", present);
        setText("absentCount", absent);
        setText("attendanceRate", percentage + "%");

        if ($("lateCount")) {
            setText("lateCount", late);
        }

        setText(
            "selectedClassHeading",
            getClassLabel(currentProfile.class_id)
        );

        renderStudentAttendance();
        renderHistory(attendanceRecords);
    }

    function renderStudentAttendance() {
        const body = $("attendanceTableBody");
        if (!body) return;

        body.replaceChildren();

        if (attendanceRecords.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent = "No attendance records found yet.";

            row.appendChild(cell);
            body.appendChild(row);
            return;
        }

        attendanceRecords.forEach((record, index) => {
            const row = document.createElement("tr");

            createCell(row, index + 1);
            createCell(row, formatDate(record.attendance_date));
            createCell(row, getClassLabel(record.class_id));

            const statusCell = document.createElement("td");
            statusCell.appendChild(createStatusBadge(record.status));
            row.appendChild(statusCell);

            createCell(row, "—");
            body.appendChild(row);
        });
    }

    async function loadAttendanceHistory() {
        if (!selectedClassId) return;

        const { data, error } = await supabaseClient
            .from("attendance")
            .select("id, student_id, class_id, attendance_date, status")
            .eq("class_id", selectedClassId)
            .order("attendance_date", { ascending: false })
            .limit(100);

        if (error) {
            throw new Error(
                "Unable to load attendance history: " + error.message
            );
        }

        attendanceRecords = data || [];
        renderHistory(attendanceRecords);
    }

    function renderHistory(records) {
        const body = $("attendanceHistoryBody");
        if (!body) return;

        body.replaceChildren();

        if (!records || records.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent = "No saved attendance found.";

            row.appendChild(cell);
            body.appendChild(row);
            return;
        }

        const profileIds = [
            ...new Set(records.map(item => item.student_id))
        ];

        loadStudentNames(profileIds).then(studentNames => {
            body.replaceChildren();

            records.forEach((record, index) => {
                const row = document.createElement("tr");

                createCell(row, index + 1);
                createCell(
                    row,
                    studentNames[record.student_id] || "Student"
                );
                createCell(row, getClassLabel(record.class_id));
                createCell(row, formatDate(record.attendance_date));

                const statusCell = document.createElement("td");
                statusCell.appendChild(createStatusBadge(record.status));
                row.appendChild(statusCell);

                body.appendChild(row);
            });
        }).catch(error => {
            console.error("History names error:", error);

            body.replaceChildren();

            records.forEach((record, index) => {
                const row = document.createElement("tr");

                createCell(row, index + 1);
                createCell(row, "Student");
                createCell(row, getClassLabel(record.class_id));
                createCell(row, formatDate(record.attendance_date));

                const statusCell = document.createElement("td");
                statusCell.appendChild(createStatusBadge(record.status));
                row.appendChild(statusCell);

                body.appendChild(row);
            });
        });
    }

    async function loadStudentNames(ids) {
        if (!ids.length) return {};

        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, name")
            .in("id", ids);

        if (error) throw error;

        const names = {};

        (data || []).forEach(profile => {
            names[profile.id] = profile.name;
        });

        return names;
    }

    function setupEvents() {
        const loadButton = $("loadAttendanceBtn");

        if (loadButton) {
            loadButton.addEventListener("click", loadTeacherAttendance);
        }

        const classSelect = $("classSelect");

        if (classSelect) {
            classSelect.addEventListener("change", () => {
                selectedClassId = classSelect.value;
                attendanceMap = {};
            });
        }

        const dateInput = $("attendanceDate");

        if (dateInput) {
            dateInput.value = getLocalDate();

            dateInput.addEventListener("change", () => {
                selectedDate = dateInput.value;
                attendanceMap = {};
            });
        }

        $("markAllPresent")?.addEventListener(
            "click",
            () => markAll("present")
        );

        $("markAllAbsent")?.addEventListener(
            "click",
            () => markAll("absent")
        );

        $("saveAttendanceBtn")?.addEventListener(
            "click",
            saveAttendance
        );

        $("moduleLogout")?.addEventListener("click", async event => {
            event.preventDefault();

            try {
                const { error } = await supabaseClient.auth.signOut();

                if (error) throw error;

                localStorage.removeItem("smartsphereUser");
                window.location.replace("index.html");

            } catch (error) {
                console.error("Logout error:", error);
                showMessage("Unable to log out: " + error.message, "error");
            }
        });
    }

    async function initializeAttendance() {
        try {
            const authenticated = await initializeSupabase();

            if (!authenticated) return;

            setProfileInformation();
            setupEvents();

            const role = String(currentProfile.role).toLowerCase();

            if (role === "student") {
                await loadClasses();
                await loadStudentAttendance();
                return;
            }

            if (role !== "teacher" && role !== "admin") {
                throw new Error(
                    "You do not have permission to access attendance."
                );
            }

            await loadClasses();

            if (role === "admin") {
                setText("panelTitle", "Attendance Overview");
                setText(
                    "panelDescription",
                    "Review attendance records across classes."
                );

                setVisibility("teacherActions", false);
                setVisibility("teacherSaveArea", false);
            }

            if (classes.length === 0) {
                showMessage(
                    role === "teacher"
                        ? "No classes have been allocated to your account."
                        : "No classes are available. Create a class first.",
                    "info"
                );

                students = [];
                renderAttendanceTable();
                updateStatistics();
                return;
            }

            selectedClassId = $("classSelect")?.value || classes[0].id;

            if ($("classSelect")) {
                $("classSelect").value = selectedClassId;
            }

            await loadTeacherAttendance();

        } catch (error) {
            console.error("Attendance initialization error:", error);
            showMessage(error.message, "error");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAttendance
        );
    } else {
        initializeAttendance();
    }

})();
