
(function () {
    "use strict";

    function getElement(id) {
        return document.getElementById(id);
    }

    function readArray(key) {
        try {
            var data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Storage read error:", error);
            return [];
        }
    }

    function saveArray(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Storage save error:", error);
            alert("Unable to save data. Please check browser storage.");
            return false;
        }
    }

    function createCell(value) {
        var cell = document.createElement("td");
        cell.textContent = value || "";
        return cell;
    }

    function createPersonCell(name, color) {
        var cell = document.createElement("td");
        var wrapper = document.createElement("div");
        var avatar = document.createElement("div");
        var strong = document.createElement("strong");

        var initials = String(name || "NA")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(function (word) {
                return word.charAt(0);
            })
            .join("")
            .toUpperCase();

        wrapper.className = "admin-person";
        avatar.className = "person-avatar " + color;
        avatar.textContent = initials || "NA";
        strong.textContent = name;

        wrapper.appendChild(avatar);
        wrapper.appendChild(strong);
        cell.appendChild(wrapper);

        return cell;
    }

    function createStatusCell() {
        var cell = document.createElement("td");
        var status = document.createElement("span");

        status.className = "admin-status active-status";
        status.textContent = "Active";

        cell.appendChild(status);
        return cell;
    }

    function generateId(prefix, records, field, start) {
        var maximum = start - 1;

        records.forEach(function (record) {
            var match = String(record[field] || "").match(/(\d+)$/);

            if (match) {
                maximum = Math.max(maximum, Number(match[1]));
            }
        });

        return prefix + (maximum + 1);
    }

    function initializeAdmin() {
        var modal = getElement("adminModal");
        var form = getElement("adminRecordForm");

        var modalTitle = getElement("modalTitle");
        var modalDescription = getElement("modalDescription");
        var recordType = getElement("recordType");

        var personFields = getElement("personFields");
        var studentClassField = getElement("studentClassField");
        var teacherDepartmentField = getElement("teacherDepartmentField");
        var classNameField = getElement("classNameField");

        var recordName = getElement("recordName");
        var recordEmail = getElement("recordEmail");
        var recordClass = getElement("recordClass");
        var recordDepartment = getElement("recordDepartment");

        var newClassName = getElement("newClassName");
        var newSectionName = getElement("newSectionName");

        var studentTable = getElement("studentTableBody");
        var teacherTable = getElement("teacherTableBody");
        var classPanel = getElement("classes");

        if (
            !modal || !form || !recordType ||
            !personFields || !studentClassField ||
            !teacherDepartmentField || !classNameField ||
            !studentTable || !teacherTable || !classPanel
        ) {
            console.error("Admin HTML is missing one or more required IDs.");
            return;
        }

        var students = readArray("smartsphereStudents");
        var teachers = readArray("smartsphereTeachers");
        var classes = readArray("smartsphereClasses");

        function openModal(type) {
            form.reset();

            recordType.value = type;

            personFields.hidden = type === "class";
            studentClassField.hidden = type !== "student";
            teacherDepartmentField.hidden = type !== "teacher";
            classNameField.hidden = type !== "class";

            recordName.required = type !== "class";
            recordEmail.required = type !== "class";
            recordClass.required = type === "student";
            recordDepartment.required = type === "teacher";
            newClassName.required = type === "class";
            newSectionName.required = type === "class";

            if (type === "student") {
                modalTitle.textContent = "Add Student";
                modalDescription.textContent =
                    "Enter the new student's details.";
            } else if (type === "teacher") {
                modalTitle.textContent = "Add Teacher";
                modalDescription.textContent =
                    "Enter the new teacher's details.";
            } else {
                modalTitle.textContent = "Add Class";
                modalDescription.textContent =
                    "Enter the class and section details.";
            }

            modal.hidden = false;
            modal.style.display = "flex";
            document.body.classList.add("admin-modal-open");

            if (type === "class") {
                newClassName.focus();
            } else {
                recordName.focus();
            }
        }

        function closeModal() {
            modal.hidden = true;
            modal.style.display = "none";

            document.body.classList.remove("admin-modal-open");
            form.reset();
        }

        function renderStudents() {
            students.forEach(function (student, index) {
                var row = document.createElement("tr");

                row.appendChild(
                    createPersonCell(
                        student.name,
                        index % 2 === 0 ? "person-purple" : "person-blue"
                    )
                );

                row.appendChild(createCell(student.studentId));
                row.appendChild(createCell(student.className));
                row.appendChild(createCell(student.email));
                row.appendChild(createStatusCell());

                studentTable.appendChild(row);
            });

            var total = getElement("totalStudents");

            if (total) {
                total.textContent =
                    (1250 + students.length).toLocaleString("en-IN");
            }
        }

        function renderTeachers() {
            teachers.forEach(function (teacher, index) {
                var row = document.createElement("tr");

                row.appendChild(
                    createPersonCell(
                        teacher.name,
                        index % 2 === 0 ? "person-blue" : "person-purple"
                    )
                );

                row.appendChild(createCell(teacher.teacherId));
                row.appendChild(createCell(teacher.department));
                row.appendChild(createCell(teacher.email));
                row.appendChild(createStatusCell());

                teacherTable.appendChild(row);
            });

            var total = getElement("totalTeachers");

            if (total) {
                total.textContent =
                    (68 + teachers.length).toLocaleString("en-IN");
            }
        }

        function renderClasses() {
            var oldRows = classPanel.querySelectorAll(
                "[data-smartsphere-class]"
            );

            oldRows.forEach(function (row) {
                row.remove();
            });

            classes.forEach(function (item, index) {
                var row = document.createElement("div");
                var color = document.createElement("div");
                var info = document.createElement("div");
                var name = document.createElement("strong");
                var section = document.createElement("span");
                var arrow = document.createElement("i");

                row.className = "admin-class-row";
                row.setAttribute("data-smartsphere-class", "true");

                var colorName = "one";

                if (index % 3 === 1) {
                    colorName = "two";
                } else if (index % 3 === 2) {
                    colorName = "three";
                }

                color.className = "class-color class-color-" + colorName;
                color.textContent =
                    String(item.name || "").replace(/^class\s*/i, "").trim();

                info.className = "admin-class-info";
                name.textContent = item.name;
                section.textContent = "Section " + item.section;

                arrow.className = "fas fa-chevron-right";

                info.appendChild(name);
                info.appendChild(section);

                row.appendChild(color);
                row.appendChild(info);
                row.appendChild(arrow);

                classPanel.appendChild(row);
            });

            var total = getElement("totalClasses");

            if (total) {
                total.textContent =
                    (32 + classes.length).toLocaleString("en-IN");
            }
        }

        function bindButton(id, type) {
            var button = getElement(id);

            if (button) {
                button.addEventListener("click", function (event) {
                    event.preventDefault();
                    openModal(type);
                });
            }
        }

        bindButton("addStudentBtn", "student");
        bindButton("studentPanelAddBtn", "student");

        bindButton("addTeacherBtn", "teacher");
        bindButton("teacherPanelAddBtn", "teacher");

        bindButton("addClassBtn", "class");

        var closeButton = getElement("closeModalBtn");

        if (closeButton) {
            closeButton.addEventListener("click", closeModal);
        }

        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                closeModal();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !modal.hidden) {
                closeModal();
            }
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var type = recordType.value;

            if (type === "student") {
                var name = recordName.value.trim();
                var email = recordEmail.value.trim().toLowerCase();
                var className = recordClass.value.trim();

                if (!name || !email || !className) {
                    alert("Please complete all student fields.");
                    return;
                }

                var duplicateStudent = students.some(function (student) {
                    return String(student.email || "").toLowerCase() === email;
                });

                if (duplicateStudent) {
                    alert("This student email already exists.");
                    return;
                }

                var student = {
                    name: name,
                    email: email,
                    className: className,
                    studentId: generateId(
                        "STU",
                        students,
                        "studentId",
                        1004
                    )
                };

                students.push(student);

                if (!saveArray("smartsphereStudents", students)) {
                    students.pop();
                    return;
                }

                var studentRow = document.createElement("tr");

                studentRow.appendChild(
                    createPersonCell(student.name, "person-purple")
                );
                studentRow.appendChild(createCell(student.studentId));
                studentRow.appendChild(createCell(student.className));
                studentRow.appendChild(createCell(student.email));
                studentRow.appendChild(createStatusCell());

                studentTable.appendChild(studentRow);

                var studentTotal = getElement("totalStudents");

                if (studentTotal) {
                    studentTotal.textContent =
                        (1250 + students.length).toLocaleString("en-IN");
                }

                alert("Student added successfully.");
            }

            else if (type === "teacher") {
                var teacherName = recordName.value.trim();
                var teacherEmail = recordEmail.value.trim().toLowerCase();
                var department = recordDepartment.value.trim();

                if (!teacherName || !teacherEmail || !department) {
                    alert("Please complete all teacher fields.");
                    return;
                }

                var duplicateTeacher = teachers.some(function (teacher) {
                    return String(teacher.email || "").toLowerCase() === teacherEmail;
                });

                if (duplicateTeacher) {
                    alert("This teacher email already exists.");
                    return;
                }

                var teacher = {
                    name: teacherName,
                    email: teacherEmail,
                    department: department,
                    teacherId: generateId(
                        "FAC",
                        teachers,
                        "teacherId",
                        2004
                    )
                };

                teachers.push(teacher);

                if (!saveArray("smartsphereTeachers", teachers)) {
                    teachers.pop();
                    return;
                }

                var teacherRow = document.createElement("tr");

                teacherRow.appendChild(
                    createPersonCell(teacher.name, "person-blue")
                );
                teacherRow.appendChild(createCell(teacher.teacherId));
                teacherRow.appendChild(createCell(teacher.department));
                teacherRow.appendChild(createCell(teacher.email));
                teacherRow.appendChild(createStatusCell());

                teacherTable.appendChild(teacherRow);

                var teacherTotal = getElement("totalTeachers");

                if (teacherTotal) {
                    teacherTotal.textContent =
                        (68 + teachers.length).toLocaleString("en-IN");
                }

                alert("Teacher added successfully.");
            }

            else if (type === "class") {
                var classNameValue = newClassName.value.trim();
                var sectionValue = newSectionName.value.trim();

                if (!classNameValue || !sectionValue) {
                    alert("Please enter both class name and section.");
                    return;
                }

                var duplicateClass = classes.some(function (item) {
                    return (
                        String(item.name || "").toLowerCase() ===
                            classNameValue.toLowerCase() &&
                        String(item.section || "").toLowerCase() ===
                            sectionValue.toLowerCase()
                    );
                });

                if (duplicateClass) {
                    alert("This class and section already exists.");
                    return;
                }

                classes.push({
                    name: classNameValue,
                    section: sectionValue
                });

                if (!saveArray("smartsphereClasses", classes)) {
                    classes.pop();
                    return;
                }

                renderClasses();

                alert("Class added successfully.");
            }

            else {
                alert("Invalid record type. Please close and reopen the form.");
                return;
            }

            closeModal();
        });

        var logoutButton = getElement("logoutBtn");

        if (logoutButton) {
            logoutButton.addEventListener("click", function () {
                localStorage.removeItem("smartsphereUser");
                window.location.href = "index.html";
            });
        }

        try {
            var user = JSON.parse(
                localStorage.getItem("smartsphereUser") || "null"
            );

            if (user && user.role &&
                String(user.role).toLowerCase() === "admin") {

                var adminName = user.name || "Administrator";
                var initials = adminName.trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map(function (word) {
                        return word.charAt(0);
                    })
                    .join("")
                    .toUpperCase();

                if (getElement("adminName")) {
                    getElement("adminName").textContent = adminName;
                }

                if (getElement("sidebarAdminName")) {
                    getElement("sidebarAdminName").textContent = adminName;
                }

                if (getElement("adminAvatar")) {
                    getElement("adminAvatar").textContent = initials || "AD";
                }

                if (getElement("topAdminAvatar")) {
                    getElement("topAdminAvatar").textContent = initials || "AD";
                }
            }
        } catch (error) {
            console.error("Admin session error:", error);
        }

        var dateElement = getElement("adminDate");

        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString(
                "en-IN",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
        }

        renderStudents();
        renderTeachers();
        renderClasses();

        closeModal();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeAdmin);
    } else {
        initializeAdmin();
    }
})();
