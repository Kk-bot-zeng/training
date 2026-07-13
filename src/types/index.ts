// Department
export interface Department {
  id: number;
  name: string;
  createdAt: string;
  _count?: { employees: number };
}

// Employee
export interface Employee {
  id: number;
  name: string;
  employeeNo: string | null;
  departmentId: number;
  department?: Department;
  status: "active" | "inactive";
  phone: string | null;
  createdAt: string;
}

// Training
export interface Training {
  id: number;
  title: string;
  description: string | null;
  type: "training" | "exam";
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  departmentIds: string; // JSON array
  qrToken: string;
  status: "upcoming" | "ongoing" | "completed";
  createdAt: string;
  _count?: { attendance: number };
}

// Attendance
export interface Attendance {
  id: number;
  trainingId: number;
  employeeId: number;
  status: "present" | "late" | "leave" | "absent";
  checkInTime: string | null;
  remark: string | null;
  createdAt: string;
  employee?: Employee;
  training?: Training;
}

// Statistics
export interface AttendanceRate {
  trainingTitle: string;
  total: number;
  present: number;
  late: number;
  leave: number;
  absent: number;
  presentRate: string;
  absentRate: string;
}

export interface DepartmentRate {
  id: number;
  name: string;
  total: number;
  attended: number;
  rate: string;
}

export interface OverviewStats {
  totalEmployees: number;
  totalTrainingsThisMonth: number;
  avgAttendanceRate: number;
  activeDepartments: number;
  recentTrainings: { id: number; title: string; date: string; rate: number }[];
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
