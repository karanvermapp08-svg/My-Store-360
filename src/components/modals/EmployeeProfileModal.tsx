import React from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Building,
  Briefcase,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Shield,
  Edit2
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const EmployeeProfileModal: React.FC = () => {
  const {
    isEmployeeDetailModalOpen,
    setIsEmployeeDetailModalOpen,
    selectedEmployee,
    setSelectedEmployee,
    setIsAddEmployeeModalOpen,
    attendanceRecords,
    roles,
  } = useVyapar();

  if (!isEmployeeDetailModalOpen || !selectedEmployee) return null;

  const roleObj = roles.find((r) => r.id === selectedEmployee.roleId);
  const employeeAttendance = attendanceRecords.filter(
    (a) => a.employeeId === selectedEmployee.employeeId
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Top Banner Header */}
        <div className="relative bg-slate-900 text-white p-5 pb-6">
          <button
            onClick={() => setIsEmployeeDetailModalOpen(false)}
            className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4">
            {selectedEmployee.avatar ? (
              <img
                src={selectedEmployee.avatar}
                alt={selectedEmployee.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shrink-0 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xl shrink-0">
                {selectedEmployee.name.charAt(0)}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{selectedEmployee.name}</h2>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white tracking-wide"
                  style={{ backgroundColor: roleObj?.color || '#3b82f6' }}
                >
                  {selectedEmployee.roleName}
                </span>
              </div>

              <div className="text-slate-300 font-mono text-xs mt-0.5 font-bold">
                {selectedEmployee.employeeId} • {selectedEmployee.designation}
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2">
                <span>{selectedEmployee.department}</span>
                <span>•</span>
                <span>Joined {selectedEmployee.joiningDate}</span>
                <span>•</span>
                <span
                  className={`font-semibold ${
                    selectedEmployee.status === 'Active' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {selectedEmployee.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-medium">Monthly Salary</span>
              <strong className="text-sm font-bold text-slate-900 tabular-nums">
                ₹ {selectedEmployee.salary.toLocaleString('en-IN')}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-medium">Closed Sales</span>
              <strong className="text-sm font-bold text-emerald-600 tabular-nums">
                ₹ {selectedEmployee.totalSalesAchieved.toLocaleString('en-IN')}
              </strong>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-medium">Commission Earned</span>
              <strong className="text-sm font-bold text-blue-600 tabular-nums">
                ₹ {selectedEmployee.totalCommissionEarned.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          {/* Contact & Government Details */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">Official Contact &amp; Branch Record</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Email Address</span>
                <span className="text-slate-800 font-medium">{selectedEmployee.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Mobile Phone</span>
                <span className="text-slate-800 font-medium">{selectedEmployee.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Assigned Branch</span>
                <span className="text-slate-800 font-medium">{selectedEmployee.assignedBranch}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Aadhaar / ID Card</span>
                <span className="text-slate-800 font-mono">{selectedEmployee.governmentId || 'Verified On File'}</span>
              </div>
            </div>
            {selectedEmployee.address && (
              <div className="pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-400 block text-[10px]">Residential Address</span>
                <span className="text-slate-700">{selectedEmployee.address}</span>
              </div>
            )}
          </div>

          {/* Performance & Rating */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Customer Satisfaction &amp; Quality</h4>
              <p className="text-[11px] text-slate-500">Based on orders fulfilled and billing speed</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full font-bold text-xs">
              <span>★ {selectedEmployee.rating} / 5.0</span>
              <span className="text-[10px] font-normal text-slate-500">({selectedEmployee.ordersHandled} orders)</span>
            </div>
          </div>

          {/* Attendance History */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">Recent Shift Punches</h4>
            {employeeAttendance.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">No shift punch records yet today.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {employeeAttendance.map((att) => (
                  <div key={att.id} className="p-2.5 px-3 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-600">{att.date}</span>
                    <span className="font-semibold text-emerald-600">IN: {att.punchInTime}</span>
                    <span className="text-slate-600">OUT: {att.punchOutTime || 'Active'}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {att.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={() => {
              setIsEmployeeDetailModalOpen(false);
              setIsAddEmployeeModalOpen(true);
            }}
            className="flex items-center gap-1 text-blue-600 hover:underline font-semibold"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Full Profile</span>
          </button>

          <button
            onClick={() => setIsEmployeeDetailModalOpen(false)}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
