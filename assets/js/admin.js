
(function () {
    "use strict";

    const SUPABASE_URL = "https://tmplfykqfhvwgfoavjlx.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3GfaeEPt1nf-nWOGW1XCVw_8GOEe_0D";

    let supabaseClient = null;
    let students = [];
    let teachers = [];
    let classes = [];
    let allocations = [];
    let editingStudentId = null;
    let editingTeacherId = null;

    const $ = id => document.getElementById(id);

    function showError(message) {
        alert(message || "Something went wrong. Please try again.");
    }

    function getInitials(name) {
        return String(name || "NA")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase() || "NA";
    }

    function createCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value || "—";
        row.appendChild(cell);
    }

    function createPersonCell(row, name, color) {
        const cell = document.createElement("td");
        const wrapper = document.createElement("div");
        const avatar = document.createElement("div");
        const strong = document.createElement("strong");

        wrapper.className = "admin-person";
        avatar.className = "person-avatar " + color;
        avatar.textContent = getInitials(name);
        strong.textContent = name || "Unknown";

        wrapper.appendChild(avatar);
        wrapper.appendChild(strong);
        cell.appendChild(wrapper);
        row.appendChild(cell);
    }

    function createStatusCell(row, statusValue) {
        const cell = document.createElement("td");
        const status = document.createElement("span");

        const active =
            String(statusValue || "active").toLowerCase() === "active";

        status.className = "admin-status " +
            (active ? "active-status" : "inactive-status");

        status.textContent = active ? "Active" : "Inactive";

        cell.appendChild(status);
        row.appendChild(cell);
    }

    function setTotal(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = Number(value).toLocaleString("en-IN");
        }
    }

    function getLocalDateString() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }

    function generateId(prefix, records, field, startingNumber) {
        let maximum = startingNumber - 1;

        records.forEach(record => {
            const match = String(record[field] || "").match(/(\d+)$/);

            if (match) {
                maximum = Math.max(maximum, Number(match[1]));
            }
        });

        return prefix + (maximum + 1);
    }

    function formatDOB(dateValue) {
        const parts = dateValue.split("-");
        return parts[2] + "-" + parts[1] + "-" + parts[0];
    }

    function normalizeClassName(value) {
        return String(value || "")
            .trim()
            .replace(/^class\s*/i, "")
            .replace(/\s+/g, "")
            .toLowerCase();
    }

    function getClassLabel(classId) {
        const item = classes.find(record => record.id === classId);

        return item
            ? item.class_name + " - " + item.section
            : "Not assigned";
    }

    function findClassId(inputValue) {
        const value = String(inputValue || "").trim();
        const separatorIndex = value.lastIndexOf("-");

        if (separatorIndex === -1) {
            return null;
        }

        const enteredClass = normalizeClassName(
            value.substring(0, separatorIndex)
        );

        const enteredSection = value
            .substring(separatorIndex + 1)
            .trim()
            .toLowerCase();

        const matchingClass = classes.find(item => {
            return (
                normalizeClassName(item.class_name) === enteredClass &&
                String(item.section || "").trim().toLowerCase() ===
                    enteredSection
            );
        });

        return matchingClass ? matchingClass.id : null;
    }

    // ADMIN INFORMATION

    function displayAdmin(profile) {
        const name = profile.name || profile.email || "Administrator";
        const avatar = getInitials(name);

        if ($("adminName")) $("adminName").textContent = name;
        if ($("welcomeAdminName")) $("welcomeAdminName").textContent = name;
        if ($("sidebarAdminName")) $("sidebarAdminName").textContent = name;
        if ($("adminAvatar")) $("adminAvatar").textContent = avatar;
        if ($("topAdminAvatar")) $("topAdminAvatar").textContent = avatar;

        if ($("adminDate")) {
            $("adminDate").textContent = new Date().toLocaleDateString(
                "en-IN",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
        }
    }

    // DATABASE LOADING

    async function loadDashboardData() {
        const [
            studentResult,
            teacherResult,
            classResult,
            allocationResult
        ] = await Promise.all([
            supabaseClient
                .from("profiles")
                .select("id, name, email, student_id, status, class_id")
                .eq("role", "student")
                .order("name"),

            supabaseClient
                .from("profiles")
                .select("id, name, email, teacher_id, department, status")
                .eq("role", "teacher")
                .order("name"),

            supabaseClient
                .from("classes")
                .select("id, class_name, section, academic_year")
                .order("class_name")
                .order("section"),

            supabaseClient
                .from("teacher_allocations")
                .select("id, teacher_id, class_id, subject, created_at")
                .order("created_at", { ascending: false })
        ]);

        if (studentResult.error) {
            throw new Error(
                "Unable to load students: " + studentResult.error.message
            );
        }

        if (teacherResult.error) {
            throw new Error(
                "Unable to load teachers: " + teacherResult.error.message
            );
        }

        if (classResult.error) {
            throw new Error(
                "Unable to load classes: " + classResult.error.message
            );
        }

        if (allocationResult.error) {
            throw new Error(
                "Unable to load teacher allocations: " +
                allocationResult.error.message
            );
        }

        students = studentResult.data || [];
        teachers = teacherResult.data || [];
        classes = classResult.data || [];
        allocations = allocationResult.data || [];

        renderStudents();
        renderTeachers();
        renderClasses();

        setupAllocationManagement();
        renderAllocations();

        await loadTodayAttendance();
    }

    // SHARED ACTION BUTTON

    function createActionButton(label, action, recordId, background) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.recordId = recordId;

        button.style.border = "none";
        button.style.borderRadius = "6px";
        button.style.padding = "7px 10px";
        button.style.margin = "2px";
        button.style.cursor = "pointer";
        button.style.fontSize = "12px";
        button.style.fontWeight = "600";
        button.style.background = background;
        button.style.color = "#fff";

        return button;
    }

    // STUDENT MANAGEMENT CONTROLS

    function setupStudentControls() {
        const tableBody = $("studentTableBody");

        if (!tableBody) return;

        const table = tableBody.closest("table");
        if (!table) return;

        let tools = $("studentManagementTools");

        if (!tools) {
            tools = document.createElement("div");
            tools.id = "studentManagementTools";
            tools.style.display = "flex";
            tools.style.flexWrap = "wrap";
            tools.style.gap = "12px";
            tools.style.margin = "0 0 18px";
            tools.style.alignItems = "center";

            const search = document.createElement("input");
            search.id = "studentSearchInput";
            search.type = "search";
            search.placeholder = "Search name, email or Student ID...";
            search.setAttribute("aria-label", "Search students");

            const filter = document.createElement("select");
            filter.id = "studentClassFilter";
            filter.setAttribute("aria-label", "Filter students by class");

            [search, filter].forEach(element => {
                element.style.padding = "11px 13px";
                element.style.border = "1px solid #dce2ec";
                element.style.borderRadius = "9px";
                element.style.background = "#fff";
                element.style.fontSize = "14px";
                element.style.minWidth = "210px";
                element.style.maxWidth = "100%";
            });

            search.style.flex = "1";

            tools.appendChild(search);
            tools.appendChild(filter);

            const wrapper = table.closest(".admin-table-wrapper") ||
                table.parentElement;

            if (wrapper && wrapper.parentElement) {
                wrapper.parentElement.insertBefore(tools, wrapper);
            }
        }

        const filter = $("studentClassFilter");

        if (filter) {
            const selectedValue = filter.value;

            filter.replaceChildren();

            const allOption = document.createElement("option");
            allOption.value = "";
            allOption.textContent = "All Classes";
            filter.appendChild(allOption);

            classes.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent =
                    item.class_name + " - " + item.section;
                filter.appendChild(option);
            });

            filter.value = selectedValue;
        }

        const headerRow = table.querySelector("thead tr");

        if (
            headerRow &&
            !headerRow.querySelector(".student-actions-heading")
        ) {
            const heading = document.createElement("th");
            heading.className = "student-actions-heading";
            heading.textContent = "Actions";
            headerRow.appendChild(heading);
        }

        const searchInput = $("studentSearchInput");
        const classFilter = $("studentClassFilter");

        if (searchInput && !searchInput.dataset.bound) {
            searchInput.addEventListener("input", renderStudents);
            searchInput.dataset.bound = "true";
        }

        if (classFilter && !classFilter.dataset.bound) {
            classFilter.addEventListener("change", renderStudents);
            classFilter.dataset.bound = "true";
        }

        if (!tableBody.dataset.actionsBound) {
            tableBody.addEventListener("click", handleStudentAction);
            tableBody.dataset.actionsBound = "true";
        }
    }

    // STUDENT TABLE

    function renderStudents() {
        const tableBody = $("studentTableBody");

        if (!tableBody) return;

        setupStudentControls();
        tableBody.replaceChildren();

        const searchValue = String(
            $("studentSearchInput")?.value || ""
        ).trim().toLowerCase();

        const classValue = $("studentClassFilter")?.value || "";

        const filteredStudents = students.filter(student => {
            const matchesSearch = [
                student.name,
                student.email,
                student.student_id
            ].some(value =>
                String(value || "").toLowerCase().includes(searchValue)
            );

            const matchesClass =
                !classValue || student.class_id === classValue;

            return matchesSearch && matchesClass;
        });

        if (filteredStudents.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
            cell.textContent = students.length === 0
                ? "No students found. Add your first student."
                : "No students match your search or filter.";

            row.appendChild(cell);
            tableBody.appendChild(row);
        } else {
            filteredStudents.forEach((student, index) => {
                const row = document.createElement("tr");

                createPersonCell(
                    row,
                    student.name,
                    index % 2 === 0 ? "person-purple" : "person-blue"
                );

                createCell(row, student.student_id);
                createCell(row, getClassLabel(student.class_id));
                createCell(row, student.email);
                createStatusCell(row, student.status);

                const actionCell = document.createElement("td");

                actionCell.appendChild(
                    createActionButton(
                        "Edit",
                        "edit",
                        student.id,
                        "#2563eb"
                    )
                );

                const active =
                    String(student.status || "active").toLowerCase() ===
                    "active";

                actionCell.appendChild(
                    createActionButton(
                        active ? "Deactivate" : "Activate",
                        "toggle",
                        student.id,
                        active ? "#d97706" : "#16a34a"
                    )
                );

                row.appendChild(actionCell);
                tableBody.appendChild(row);
            });
        }

        setTotal("totalStudents", students.length);
    }

    async function handleStudentAction(event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const studentId = button.dataset.recordId;
        const action = button.dataset.action;

        const student = students.find(item => item.id === studentId);

        if (!student) {
            showError("Student record could not be found.");
            return;
        }

        if (action === "edit") {
            openEditStudent(student);
            return;
        }

        if (action === "toggle") {
            await toggleStudentStatus(student, button);
        }
    }

    async function toggleStudentStatus(student, button) {
        const currentlyActive =
            String(student.status || "active").toLowerCase() === "active";

        const newStatus = currentlyActive ? "inactive" : "active";

        const confirmed = confirm(
            "Are you sure you want to " +
            (currentlyActive ? "deactivate" : "activate") +
            " " + student.name + "?"
        );

        if (!confirmed) return;

        button.disabled = true;

        try {
            const { error } = await supabaseClient
                .from("profiles")
                .update({ status: newStatus })
                .eq("id", student.id)
                .eq("role", "student");

            if (error) {
                throw new Error(
                    "Unable to update student status: " + error.message
                );
            }

            await loadDashboardData();

            alert(
                student.name + "'s account has been " +
                newStatus + "."
            );

        } catch (error) {
            console.error("Student status error:", error);
            showError(error.message);
            button.disabled = false;
        }
    }

    // TEACHER MANAGEMENT CONTROLS

    function setupTeacherControls() {
        const tableBody = $("teacherTableBody");

        if (!tableBody) return;

        const table = tableBody.closest("table");
        if (!table) return;

        let tools = $("teacherManagementTools");

        if (!tools) {
            tools = document.createElement("div");
            tools.id = "teacherManagementTools";
            tools.style.display = "flex";
            tools.style.flexWrap = "wrap";
            tools.style.gap = "12px";
            tools.style.margin = "0 0 18px";
            tools.style.alignItems = "center";

            const search = document.createElement("input");
            search.id = "teacherSearchInput";
            search.type = "search";
            search.placeholder = "Search name, email or Teacher ID...";
            search.setAttribute("aria-label", "Search teachers");

            const filter = document.createElement("select");
            filter.id = "teacherDepartmentFilter";
            filter.setAttribute(
                "aria-label",
                "Filter teachers by department"
            );

            [search, filter].forEach(element => {
                element.style.padding = "11px 13px";
                element.style.border = "1px solid #dce2ec";
                element.style.borderRadius = "9px";
                element.style.background = "#fff";
                element.style.fontSize = "14px";
                element.style.minWidth = "210px";
                element.style.maxWidth = "100%";
            });

            search.style.flex = "1";

            tools.appendChild(search);
            tools.appendChild(filter);

            const wrapper = table.closest(".admin-table-wrapper") ||
                table.parentElement;

            if (wrapper && wrapper.parentElement) {
                wrapper.parentElement.insertBefore(tools, wrapper);
            }
        }

        const filter = $("teacherDepartmentFilter");

        if (filter) {
            const selectedValue = filter.value;

            filter.replaceChildren();

            const allOption = document.createElement("option");
            allOption.value = "";
            allOption.textContent = "All Departments";
            filter.appendChild(allOption);

            const departments = [
                ...new Set(
                    teachers
                        .map(teacher => String(teacher.department || "").trim())
                        .filter(Boolean)
                )
            ].sort((a, b) => a.localeCompare(b));

            departments.forEach(department => {
                const option = document.createElement("option");
                option.value = department;
                option.textContent = department;
                filter.appendChild(option);
            });

            filter.value = selectedValue;
        }

        const headerRow = table.querySelector("thead tr");

        if (
            headerRow &&
            !headerRow.querySelector(".teacher-actions-heading")
        ) {
            const heading = document.createElement("th");
            heading.className = "teacher-actions-heading";
            heading.textContent = "Actions";
            headerRow.appendChild(heading);
        }

        const searchInput = $("teacherSearchInput");
        const departmentFilter = $("teacherDepartmentFilter");

        if (searchInput && !searchInput.dataset.bound) {
            searchInput.addEventListener("input", renderTeachers);
            searchInput.dataset.bound = "true";
        }

        if (departmentFilter && !departmentFilter.dataset.bound) {
            departmentFilter.addEventListener("change", renderTeachers);
            departmentFilter.dataset.bound = "true";
        }

        if (!tableBody.dataset.actionsBound) {
            tableBody.addEventListener("click", handleTeacherAction);
            tableBody.dataset.actionsBound = "true";
        }
    }

    // TEACHER TABLE

    function renderTeachers() {
        const tableBody = $("teacherTableBody");

        if (!tableBody) return;

        setupTeacherControls();
        tableBody.replaceChildren();

        const searchValue = String(
            $("teacherSearchInput")?.value || ""
        ).trim().toLowerCase();

        const departmentValue =
            $("teacherDepartmentFilter")?.value || "";

        const filteredTeachers = teachers.filter(teacher => {
            const matchesSearch = [
                teacher.name,
                teacher.email,
                teacher.teacher_id
            ].some(value =>
                String(value || "").toLowerCase().includes(searchValue)
            );

            const matchesDepartment =
                !departmentValue ||
                String(teacher.department || "").trim() === departmentValue;

            return matchesSearch && matchesDepartment;
        });

        if (filteredTeachers.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
            cell.textContent = teachers.length === 0
                ? "No teachers found. Add your first teacher."
                : "No teachers match your search or filter.";

            row.appendChild(cell);
            tableBody.appendChild(row);
        } else {
            filteredTeachers.forEach((teacher, index) => {
                const row = document.createElement("tr");

                createPersonCell(
                    row,
                    teacher.name,
                    index % 2 === 0 ? "person-blue" : "person-purple"
                );

                createCell(row, teacher.teacher_id);
                createCell(row, teacher.department);
                createCell(row, teacher.email);
                createStatusCell(row, teacher.status);

                const actionCell = document.createElement("td");

                actionCell.appendChild(
                    createActionButton(
                        "Edit",
                        "edit",
                        teacher.id,
                        "#2563eb"
                    )
                );

                const active =
                    String(teacher.status || "active").toLowerCase() ===
                    "active";

                actionCell.appendChild(
                    createActionButton(
                        active ? "Deactivate" : "Activate",
                        "toggle",
                        teacher.id,
                        active ? "#d97706" : "#16a34a"
                    )
                );

                row.appendChild(actionCell);
                tableBody.appendChild(row);
            });
        }

        setTotal("totalTeachers", teachers.length);
    }

    // TEACHER ALLOCATION MANAGEMENT

    function createAllocationSelect(id, placeholder) {
        const select = document.createElement("select");

        select.id = id;
        select.required = true;
        select.style.padding = "11px 13px";
        select.style.border = "1px solid #dce2ec";
        select.style.borderRadius = "9px";
        select.style.background = "#fff";
        select.style.fontSize = "14px";
        select.style.minWidth = "190px";
        select.style.maxWidth = "100%";

        const option = document.createElement("option");
        option.value = "";
        option.textContent = placeholder;

        select.appendChild(option);

        return select;
    }

    function createAllocationInput(id, placeholder) {
        const input = document.createElement("input");

        input.id = id;
        input.type = "text";
        input.placeholder = placeholder;
        input.required = true;
        input.maxLength = 100;
        input.style.padding = "11px 13px";
        input.style.border = "1px solid #dce2ec";
        input.style.borderRadius = "9px";
        input.style.background = "#fff";
        input.style.fontSize = "14px";
        input.style.minWidth = "190px";
        input.style.maxWidth = "100%";

        return input;
    }

    function setupAllocationManagement() {
        const tools = $("teacherManagementTools");

        if (!tools) return;

        let toggleButton = $("manageAllocationsBtn");

        if (!toggleButton) {
            toggleButton = document.createElement("button");

            toggleButton.id = "manageAllocationsBtn";
            toggleButton.type = "button";
            toggleButton.textContent = "Manage Allocations";

            toggleButton.style.padding = "11px 16px";
            toggleButton.style.border = "none";
            toggleButton.style.borderRadius = "9px";
            toggleButton.style.background = "#4f46e5";
            toggleButton.style.color = "#fff";
            toggleButton.style.fontSize = "13px";
            toggleButton.style.fontWeight = "600";
            toggleButton.style.cursor = "pointer";

            tools.appendChild(toggleButton);

            toggleButton.addEventListener("click", function () {
                const panel = $("allocationManagementPanel");

                if (!panel) return;

                panel.hidden = !panel.hidden;

                toggleButton.textContent = panel.hidden
                    ? "Manage Allocations"
                    : "Hide Allocations";
            });
        }

        let panel = $("allocationManagementPanel");

        if (!panel) {
            panel = document.createElement("section");
            panel.id = "allocationManagementPanel";
            panel.hidden = true;

            panel.style.background = "#fff";
            panel.style.border = "1px solid #e2e8f0";
            panel.style.borderRadius = "12px";
            panel.style.padding = "20px";
            panel.style.marginBottom = "20px";
            panel.style.boxShadow =
                "0 4px 15px rgba(15, 23, 42, 0.04)";

            const heading = document.createElement("h3");
            heading.textContent =
                "Teacher Class & Subject Allocations";
            heading.style.margin = "0 0 8px";
            heading.style.fontSize = "18px";
            heading.style.color = "#172554";

            const description = document.createElement("p");
            description.textContent =
                "Assign teachers to multiple classes and subjects. " +
                "Each allocation is saved in the database.";
            description.style.margin = "0 0 18px";
            description.style.color = "#64748b";
            description.style.fontSize = "13px";

            const form = document.createElement("form");
            form.id = "allocationForm";
            form.style.display = "flex";
            form.style.flexWrap = "wrap";
            form.style.gap = "12px";
            form.style.alignItems = "center";
            form.style.marginBottom = "20px";

            const teacherSelect = createAllocationSelect(
                "allocationTeacher",
                "Select Teacher"
            );

            const classSelect = createAllocationSelect(
                "allocationClass",
                "Select Class & Section"
            );

            const subjectInput = createAllocationInput(
                "allocationSubject",
                "Enter Subject"
            );

            const submitButton = document.createElement("button");
            submitButton.type = "submit";
            submitButton.textContent = "Assign Teacher";

            submitButton.style.padding = "11px 18px";
            submitButton.style.border = "none";
            submitButton.style.borderRadius = "9px";
            submitButton.style.background = "#2563eb";
            submitButton.style.color = "#fff";
            submitButton.style.fontSize = "13px";
            submitButton.style.fontWeight = "600";
            submitButton.style.cursor = "pointer";

            form.appendChild(teacherSelect);
            form.appendChild(classSelect);
            form.appendChild(subjectInput);
            form.appendChild(submitButton);

            const tableTitle = document.createElement("h4");
            tableTitle.textContent = "Existing Allocations";
            tableTitle.style.margin = "10px 0 12px";
            tableTitle.style.fontSize = "15px";
            tableTitle.style.color = "#172554";

            const tableWrapper = document.createElement("div");
            tableWrapper.style.width = "100%";
            tableWrapper.style.overflowX = "auto";

            const table = document.createElement("table");
            table.style.width = "100%";
            table.style.borderCollapse = "collapse";
            table.style.minWidth = "600px";

            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");

            [
                "Teacher",
                "Teacher ID",
                "Class & Section",
                "Subject",
                "Action"
            ].forEach(label => {
                const th = document.createElement("th");
                th.textContent = label;
                th.style.padding = "12px";
                th.style.textAlign = "left";
                th.style.background = "#f1f5f9";
                th.style.color = "#475569";
                th.style.fontSize = "12px";
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);

            const tbody = document.createElement("tbody");
            tbody.id = "allocationTableBody";

            table.appendChild(thead);
            table.appendChild(tbody);
            tableWrapper.appendChild(table);

            panel.appendChild(heading);
            panel.appendChild(description);
            panel.appendChild(form);
            panel.appendChild(tableTitle);
            panel.appendChild(tableWrapper);

            tools.parentElement.insertBefore(
                panel,
                tools.nextSibling
            );

            form.addEventListener("submit", handleAllocationSubmit);
            tbody.addEventListener("click", handleAllocationAction);
        }

        populateAllocationOptions();
    }

    function populateAllocationOptions() {
        const teacherSelect = $("allocationTeacher");
        const classSelect = $("allocationClass");

        if (!teacherSelect || !classSelect) return;

        const selectedTeacher = teacherSelect.value;
        const selectedClass = classSelect.value;

        teacherSelect.replaceChildren();

        const teacherPlaceholder = document.createElement("option");
        teacherPlaceholder.value = "";
        teacherPlaceholder.textContent = "Select Teacher";
        teacherSelect.appendChild(teacherPlaceholder);

        teachers
            .filter(teacher =>
                String(teacher.status || "active").toLowerCase() === "active"
            )
            .forEach(teacher => {
                const option = document.createElement("option");

                option.value = teacher.id;
                option.textContent =
                    teacher.name +
                    (teacher.teacher_id
                        ? " (" + teacher.teacher_id + ")"
                        : "");

                teacherSelect.appendChild(option);
            });

        classSelect.replaceChildren();

        const classPlaceholder = document.createElement("option");
        classPlaceholder.value = "";
        classPlaceholder.textContent = "Select Class & Section";
        classSelect.appendChild(classPlaceholder);

        classes.forEach(item => {
            const option = document.createElement("option");

            option.value = item.id;
            option.textContent =
                item.class_name + " - " + item.section +
                (item.academic_year
                    ? " (" + item.academic_year + ")"
                    : "");

            classSelect.appendChild(option);
        });

        teacherSelect.value = selectedTeacher;
        classSelect.value = selectedClass;
    }

    function renderAllocations() {
        const tableBody = $("allocationTableBody");

        if (!tableBody) return;

        tableBody.replaceChildren();

        if (allocations.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.textContent =
                "No teacher allocations found. Create your first allocation above.";
            cell.style.padding = "18px";
            cell.style.textAlign = "center";
            cell.style.color = "#64748b";

            row.appendChild(cell);
            tableBody.appendChild(row);

            return;
        }

        allocations.forEach(allocation => {
            const row = document.createElement("tr");

            createCell(
                row,
                teachers.find(item => item.id === allocation.teacher_id)?.name ||
                "Unknown Teacher"
            );

            createCell(
                row,
                teachers.find(item => item.id === allocation.teacher_id)?.teacher_id ||
                "—"
            );

            const assignedClass = classes.find(
                item => item.id === allocation.class_id
            );

            createCell(
                row,
                assignedClass
                    ? assignedClass.class_name + " - " +
                        assignedClass.section
                    : "Unknown Class"
            );

            createCell(row, allocation.subject);

            const actionCell = document.createElement("td");

            actionCell.appendChild(
                createActionButton(
                    "Remove",
                    "remove-allocation",
                    allocation.id,
                    "#dc2626"
                )
            );

            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });
    }

    async function handleAllocationSubmit(event) {
        event.preventDefault();

        const teacherId = $("allocationTeacher").value;
        const classId = $("allocationClass").value;
        const subject = $("allocationSubject").value.trim();

        if (!teacherId || !classId || !subject) {
            showError(
                "Please select a teacher, select a class and enter a subject."
            );
            return;
        }

        const teacher = teachers.find(item => item.id === teacherId);

        if (!teacher) {
            showError("Selected teacher could not be found.");
            return;
        }

        if (
            String(teacher.status || "active").toLowerCase() !== "active"
        ) {
            showError("You cannot assign a class to an inactive teacher.");
            return;
        }

        const duplicate = allocations.some(item => {
            return (
                item.teacher_id === teacherId &&
                item.class_id === classId &&
                String(item.subject).trim().toLowerCase() ===
                    subject.toLowerCase()
            );
        });

        if (duplicate) {
            showError(
                "This teacher is already assigned to this class and subject."
            );
            return;
        }

        const form = $("allocationForm");
        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Assigning...";

        try {
            const { error } = await supabaseClient
                .from("teacher_allocations")
                .insert({
                    teacher_id: teacherId,
                    class_id: classId,
                    subject: subject
                });

            if (error) {
                if (error.code === "23505") {
                    throw new Error(
                        "This teacher, class and subject allocation already exists."
                    );
                }

                throw new Error(
                    "Unable to create allocation: " + error.message
                );
            }

            await loadDashboardData();

            $("allocationSubject").value = "";
            $("allocationTeacher").value = teacherId;
            $("allocationClass").value = "";

            alert(
                teacher.name + " has been assigned successfully."
            );

        } catch (error) {
            console.error("Allocation creation error:", error);
            showError(error.message);

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Assign Teacher";
        }
    }

    async function handleAllocationAction(event) {
        const button = event.target.closest(
            'button[data-action="remove-allocation"]'
        );

        if (!button) return;

        const allocationId = button.dataset.recordId;

        const allocation = allocations.find(
            item => item.id === allocationId
        );

        if (!allocation) {
            showError("Allocation record could not be found.");
            return;
        }

        const teacher = teachers.find(
            item => item.id === allocation.teacher_id
        );

        const assignedClass = classes.find(
            item => item.id === allocation.class_id
        );

        const confirmed = confirm(
            "Remove this teacher allocation?\n\n" +
            "Teacher: " + (teacher ? teacher.name : "Unknown") + "\n" +
            "Class: " +
            (assignedClass
                ? assignedClass.class_name + " - " + assignedClass.section
                : "Unknown") +
            "\nSubject: " + allocation.subject
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Removing...";

        try {
            const { error } = await supabaseClient
                .from("teacher_allocations")
                .delete()
                .eq("id", allocationId);

            if (error) {
                throw new Error(
                    "Unable to remove allocation: " + error.message
                );
            }

            await loadDashboardData();

            alert("Teacher allocation removed successfully.");

        } catch (error) {
            console.error("Allocation removal error:", error);
            showError(error.message);
            button.disabled = false;
            button.textContent = "Remove";
        }
    }

    // TEACHER ACTIONS

    async function handleTeacherAction(event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const teacherId = button.dataset.recordId;
        const action = button.dataset.action;

        const teacher = teachers.find(item => item.id === teacherId);

        if (!teacher) {
            showError("Teacher record could not be found.");
            return;
        }

        if (action === "edit") {
            openEditTeacher(teacher);
            return;
        }

        if (action === "toggle") {
            await toggleTeacherStatus(teacher, button);
        }
    }

    function openEditTeacher(teacher) {
        openModal("teacher");

        editingTeacherId = teacher.id;

        $("modalTitle").textContent = "Edit Teacher";
        $("modalDescription").textContent =
            "Update the teacher's name and department.";

        $("recordName").value = teacher.name || "";
        $("recordEmail").value = teacher.email || "";
        $("recordEmail").disabled = true;

        $("recordDOB").required = false;

        const dobWrapper = getFieldWrapper($("recordDOB"));

        if (dobWrapper) dobWrapper.hidden = true;

        $("teacherDepartmentField").hidden = false;
        $("recordDepartment").required = true;
        $("recordDepartment").value = teacher.department || "";

        $("recordName").focus();
    }

    async function updateTeacher() {
        const name = $("recordName").value.trim();
        const department = $("recordDepartment").value.trim();

        if (!name) {
            throw new Error("Please enter the teacher's name.");
        }

        if (!department) {
            throw new Error("Please enter the teacher's department.");
        }

        const { error } = await supabaseClient
            .from("profiles")
            .update({
                name: name,
                department: department
            })
            .eq("id", editingTeacherId)
            .eq("role", "teacher");

        if (error) {
            throw new Error(
                "Unable to update teacher: " + error.message
            );
        }

        await loadDashboardData();

        alert("Teacher details updated successfully.");
    }

    async function toggleTeacherStatus(teacher, button) {
        const currentlyActive =
            String(teacher.status || "active").toLowerCase() === "active";

        const newStatus = currentlyActive ? "inactive" : "active";

        const confirmed = confirm(
            "Are you sure you want to " +
            (currentlyActive ? "deactivate" : "activate") +
            " " + teacher.name + "?"
        );

        if (!confirmed) return;

        button.disabled = true;

        try {
            const { error } = await supabaseClient
                .from("profiles")
                .update({ status: newStatus })
                .eq("id", teacher.id)
                .eq("role", "teacher");

            if (error) {
                throw new Error(
                    "Unable to update teacher status: " + error.message
                );
            }

            await loadDashboardData();

            alert(
                teacher.name + "'s account has been " +
                newStatus + "."
            );

        } catch (error) {
            console.error("Teacher status error:", error);
            showError(error.message);
            button.disabled = false;
        }
    }

    // CLASS LIST

    function renderClasses() {
        const classList = $("classList");

        if (!classList) return;

        classList.replaceChildren();

        if (classes.length === 0) {
            const empty = document.createElement("p");

            empty.className = "admin-empty-message";
            empty.textContent = "No classes found. Add your first class.";

            classList.appendChild(empty);
        } else {
            classes.forEach((item, index) => {
                const row = document.createElement("div");
                const color = document.createElement("div");
                const info = document.createElement("div");
                const name = document.createElement("strong");
                const section = document.createElement("span");
                const arrow = document.createElement("i");

                row.className = "admin-class-row";

                color.className = "class-color class-color-" +
                    ["one", "two", "three"][index % 3];

                color.textContent = String(item.class_name)
                    .replace(/^class\s*/i, "")
                    .trim();

                info.className = "admin-class-info";
                name.textContent = item.class_name;

                section.textContent =
                    "Section " + item.section +
                    (item.academic_year
                        ? " · " + item.academic_year
                        : "");

                arrow.className = "fas fa-chevron-right";

                info.appendChild(name);
                info.appendChild(section);

                row.appendChild(color);
                row.appendChild(info);
                row.appendChild(arrow);

                classList.appendChild(row);
            });
        }

        setTotal("totalClasses", classes.length);
    }

    // TODAY'S ATTENDANCE

    async function loadTodayAttendance() {
        const attendanceElement = $("todayAttendance");

        if (!attendanceElement) return;

        const today = getLocalDateString();

        const { data, error } = await supabaseClient
            .from("attendance")
            .select("status")
            .eq("attendance_date", today);

        if (error) {
            console.error("Attendance loading error:", error);
            attendanceElement.textContent = "—";
            return;
        }

        const records = data || [];

        if (records.length === 0) {
            attendanceElement.textContent = "—";
            return;
        }

        const presentCount = records.filter(record =>
            String(record.status).toLowerCase() === "present"
        ).length;

        const percentage = Math.round(
            (presentCount / records.length) * 100
        );

        attendanceElement.textContent = percentage + "%";
    }

    // MODAL HELPERS

    function getFieldWrapper(input) {
        if (!input) return null;

        return input.closest(".form-group") ||
            input.closest(".form-field") ||
            input.parentElement;
    }

    function openModal(type) {
        const modal = $("adminModal");
        const form = $("adminRecordForm");

        if (!modal || !form) return;

        editingStudentId = null;
        editingTeacherId = null;

        form.reset();

        const dobWrapper = getFieldWrapper($("recordDOB"));

        if (dobWrapper) dobWrapper.hidden = false;

        $("recordEmail").disabled = false;

        $("recordType").value = type;

        const personFields = $("personFields");
        const studentClassField = $("studentClassField");
        const teacherDepartmentField = $("teacherDepartmentField");
        const classNameField = $("classNameField");

        personFields.hidden = type === "class";
        studentClassField.hidden = type !== "student";
        teacherDepartmentField.hidden = type !== "teacher";
        classNameField.hidden = type !== "class";

        $("recordName").required = type !== "class";
        $("recordEmail").required = type !== "class";
        $("recordDOB").required = type !== "class";

        $("recordClass").required = type === "student";
        $("recordDepartment").required = type === "teacher";

        $("newClassName").required = type === "class";
        $("newSectionName").required = type === "class";

        if (type === "student") {
            $("modalTitle").textContent = "Add Student";
            $("modalDescription").textContent =
                "Enter the student's details and date of birth.";
        } else if (type === "teacher") {
            $("modalTitle").textContent = "Add Teacher";
            $("modalDescription").textContent =
                "Enter the teacher's details and date of birth.";
        } else {
            $("modalTitle").textContent = "Add Class";
            $("modalDescription").textContent =
                "Enter the class and section details.";
        }

        modal.hidden = false;
        modal.style.display = "flex";

        document.body.classList.add("admin-modal-open");

        if (type === "class") {
            $("newClassName").focus();
        } else {
            $("recordName").focus();
        }
    }

    function openEditStudent(student) {
        openModal("student");

        editingStudentId = student.id;

        $("modalTitle").textContent = "Edit Student";
        $("modalDescription").textContent =
            "Update the student's name and class assignment.";

        $("recordName").value = student.name || "";
        $("recordEmail").value = student.email || "";
        $("recordEmail").disabled = true;

        $("recordDOB").required = false;

        const dobWrapper = getFieldWrapper($("recordDOB"));

        if (dobWrapper) dobWrapper.hidden = true;

        const assignedClass = classes.find(
            item => item.id === student.class_id
        );

        $("recordClass").value = assignedClass
            ? assignedClass.class_name + "-" + assignedClass.section
            : "";

        $("recordName").focus();
    }

    function closeModal() {
        const modal = $("adminModal");

        if (!modal) return;

        modal.hidden = true;
        modal.style.display = "none";

        document.body.classList.remove("admin-modal-open");

        editingStudentId = null;
        editingTeacherId = null;

        if ($("adminRecordForm")) {
            $("adminRecordForm").reset();
        }

        if ($("recordEmail")) {
            $("recordEmail").disabled = false;
        }

        if ($("recordDOB")) {
            $("recordDOB").required = true;
        }

        const dobWrapper = getFieldWrapper($("recordDOB"));

        if (dobWrapper) dobWrapper.hidden = false;
    }

    function bindButton(id, type) {
        const button = $(id);

        if (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                openModal(type);
            });
        }
    }

    // CREATE STUDENT OR TEACHER ACCOUNT

    async function createPerson(type) {
        const name = $("recordName").value.trim();
        const email = $("recordEmail").value.trim().toLowerCase();
        const dob = $("recordDOB").value;

        if (!name || !email || !dob) {
            throw new Error("Please complete all required fields.");
        }

        const dobDate = new Date(dob + "T00:00:00");
        const today = new Date();

        today.setHours(0, 0, 0, 0);

        if (Number.isNaN(dobDate.getTime()) || dobDate >= today) {
            throw new Error("Please enter a valid date of birth in the past.");
        }

        const password = formatDOB(dob);

        const payload = {
            name: name,
            email: email,
            password: password,
            role: type
        };

        if (type === "student") {
            const classValue = $("recordClass").value.trim();

            if (!classValue) {
                throw new Error(
                    "Please enter the student's class and section."
                );
            }

            const classId = findClassId(classValue);

            if (!classId) {
                throw new Error(
                    "Class not found. First create the class and section in the Classes & Sections panel. Then enter it in the format 10-A."
                );
            }

            payload.class_id = classId;

            payload.student_id = generateId(
                "STU",
                students,
                "student_id",
                1001
            );

        } else if (type === "teacher") {
            const department = $("recordDepartment").value.trim();

            if (!department) {
                throw new Error("Please enter the teacher's department.");
            }

            payload.department = department;

            payload.teacher_id = generateId(
                "FAC",
                teachers,
                "teacher_id",
                2001
            );
        }

        const { data, error } = await supabaseClient.functions.invoke(
            "admin-create-user",
            { body: payload }
        );

        if (error) {
            let message = error.message || "Unable to create account.";

            if (
                error.context &&
                typeof error.context.json === "function"
            ) {
                try {
                    const details = await error.context.json();

                    if (details.error) {
                        message = details.error;
                    }
                } catch (parseError) {
                    console.error("Function error details:", parseError);
                }
            }

            throw new Error(message);
        }

        if (!data || !data.success) {
            throw new Error(
                data && data.error
                    ? data.error
                    : "Account creation failed."
            );
        }

        return {
            id: type === "student"
                ? payload.student_id
                : payload.teacher_id,
            email: email,
            password: password
        };
    }

    // UPDATE STUDENT

    async function updateStudent() {
        const name = $("recordName").value.trim();
        const classValue = $("recordClass").value.trim();

        if (!name) {
            throw new Error("Please enter the student's name.");
        }

        if (!classValue) {
            throw new Error("Please select or enter the student's class.");
        }

        const classId = findClassId(classValue);

        if (!classId) {
            throw new Error(
                "Class not found. Enter the class in the format 10-A."
            );
        }

        const { error } = await supabaseClient
            .from("profiles")
            .update({
                name: name,
                class_id: classId
            })
            .eq("id", editingStudentId)
            .eq("role", "student");

        if (error) {
            throw new Error(
                "Unable to update student: " + error.message
            );
        }

        await loadDashboardData();

        alert("Student details updated successfully.");
    }

    // CREATE CLASS

    async function createClass() {
        const className = $("newClassName").value.trim();
        const section = $("newSectionName").value.trim();

        if (!className || !section) {
            throw new Error("Please enter both class name and section.");
        }

        const duplicate = classes.some(item => {
            return (
                String(item.class_name).trim().toLowerCase() ===
                    className.toLowerCase() &&
                String(item.section).trim().toLowerCase() ===
                    section.toLowerCase() &&
                String(item.academic_year || "") === "2026-2027"
            );
        });

        if (duplicate) {
            throw new Error(
                "This class and section already exists for academic session 2026-2027."
            );
        }

        const { error } = await supabaseClient
            .from("classes")
            .insert({
                class_name: className,
                section: section,
                academic_year: "2026-2027"
            });

        if (error) {
            throw new Error(
                "Unable to create class: " + error.message
            );
        }

        await loadDashboardData();

        alert("Class and section added successfully.");
    }

    // FORM SUBMISSION

    async function handleFormSubmit(event) {
        event.preventDefault();

        const type = $("recordType").value;
        const form = $("adminRecordForm");

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        if (!submitButton) return;

        const originalButtonHTML = submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            if (editingStudentId && type === "student") {
                await updateStudent();

            } else if (editingTeacherId && type === "teacher") {
                await updateTeacher();

            } else if (type === "class") {
                await createClass();

            } else if (type === "student" || type === "teacher") {
                const result = await createPerson(type);

                await loadDashboardData();

                const accountType =
                    type === "student" ? "Student" : "Teacher";

                alert(
                    accountType + " account created successfully!\n\n" +
                    "ID: " + result.id + "\n" +
                    "Email: " + result.email + "\n" +
                    "Initial Password: " + result.password + "\n\n" +
                    "Ask the user to change the password after the first login."
                );

            } else {
                throw new Error("Invalid record type.");
            }

            closeModal();

        } catch (error) {
            console.error("Admin form error:", error);
            showError(error.message);

        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    }

    // LOGOUT

    function setupLogout() {
        const logoutButton = $("logoutBtn");

        if (!logoutButton) return;

        logoutButton.addEventListener("click", async function () {
            logoutButton.disabled = true;

            try {
                const { error } = await supabaseClient.auth.signOut();

                if (error) throw error;

                localStorage.removeItem("smartsphereUser");
                window.location.replace("index.html");

            } catch (error) {
                console.error("Logout error:", error);
                showError("Unable to log out. Please try again.");
                logoutButton.disabled = false;
            }
        });
    }

    // NAVIGATION

    function setupNavigation() {
        const links = document.querySelectorAll(
            ".admin-nav a[href^='#']"
        );

        links.forEach(link => {
            link.addEventListener("click", function () {
                links.forEach(item => item.classList.remove("active"));
                link.classList.add("active");
            });
        });
    }

    // EVENT LISTENERS

    function setupEventListeners() {
        bindButton("addStudentBtn", "student");
        bindButton("studentPanelAddBtn", "student");

        bindButton("addTeacherBtn", "teacher");
        bindButton("teacherPanelAddBtn", "teacher");

        bindButton("addClassBtn", "class");
        bindButton("addClassPanelBtn", "class");

        const closeButton = $("closeModalBtn");

        if (closeButton) {
            closeButton.addEventListener("click", closeModal);
        }

        const cancelButton = $("cancelModalBtn");

        if (cancelButton) {
            cancelButton.addEventListener("click", closeModal);
        }

        const modal = $("adminModal");

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeModal();
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (
                event.key === "Escape" &&
                modal &&
                !modal.hidden
            ) {
                closeModal();
            }
        });

        const form = $("adminRecordForm");

        if (form) {
            form.addEventListener("submit", handleFormSubmit);
        }

        setupNavigation();
        setupLogout();
    }

    // INITIALIZATION

    async function initializeAdmin() {
        try {
            if (
                !window.supabase ||
                typeof window.supabase.createClient !== "function"
            ) {
                throw new Error(
                    "Supabase library could not be loaded. Check your internet connection."
                );
            }

            if (!SUPABASE_PUBLISHABLE_KEY) {
                throw new Error(
                    "Please configure your Supabase publishable key."
                );
            }

            supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );

            const { data: sessionData, error: sessionError } =
                await supabaseClient.auth.getSession();

            if (sessionError || !sessionData.session) {
                localStorage.removeItem("smartsphereUser");
                window.location.replace("index.html");
                return;
            }

            const authUser = sessionData.session.user;

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("id, name, email, role, status")
                    .eq("id", authUser.id)
                    .single();

            if (
                profileError ||
                !profile ||
                String(profile.role).toLowerCase() !== "admin" ||
                String(profile.status || "active").toLowerCase() !== "active"
            ) {
                await supabaseClient.auth.signOut();

                localStorage.removeItem("smartsphereUser");
                window.location.replace("index.html");
                return;
            }

            localStorage.setItem(
                "smartsphereUser",
                JSON.stringify({
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: profile.role,
                    status: profile.status
                })
            );

            displayAdmin(profile);
            setupEventListeners();
            closeModal();

            await loadDashboardData();

        } catch (error) {
            console.error("Admin initialization error:", error);

            showError(
                error.message ||
                "Unable to initialize the Admin Dashboard."
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAdmin
        );
    } else {
        initializeAdmin();
    }

})();
