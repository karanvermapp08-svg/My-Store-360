import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Calendar, Briefcase, DollarSign, Award, Building, Shield } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { Employee } from '../../types';

export const AddEmployeeModal: React.FC = () => {
  const {
    isAddEmployeeModalOpen,
    setIsAddEmployeeModalOpen,
    selectedEmployee,
    setSelectedEmployee,
    roles,
    employees,
    addEmployee,
    updateEmployee,
    showToast,
  } = useVyapar();

  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<Employee['department']>('Billing & Counter');
  const [designation, setDesignation] = useState('Counter Cashier');
  const [joiningDate, setJoiningDate] = useState('02/10/2026');
  const [status, setStatus] = useState<Employee['status']>('Active');
  const [roleId, setRoleId] = useState(roles[3]?.id || 'role-cashier');
  const [salary, setSalary] = useState<number>(25000);
  const [commissionRatePercent, setCommissionRatePercent] = useState<number>(1.0);
  const [assignedBranch, setAssignedBranch] = useState('Main Commercial Market, Bengaluru');
  const [governmentId, setGovernmentId] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (selectedEmployee) {
      setName(selectedEmployee.name);
      setEmployeeId(selectedEmployee.employeeId);
      setEmail(selectedEmployee.email);
      setPhone(selectedEmployee.phone);
      setDepartment(selectedEmployee.department);
      setDesignation(selectedEmployee.designation);
      setJoiningDate(selectedEmployee.joiningDate);
      setStatus(selectedEmployee.status);
      setRoleId(selectedEmployee.roleId);
      setSalary(selectedEmployee.salary);
      setCommissionRatePercent(selectedEmployee.commissionRatePercent);
      setAssignedBranch(selectedEmployee.assignedBranch);
      setGovernmentId(selectedEmployee.governmentId || '');
      setAddress(selectedEmployee.address || '');
    } else {
      // Auto-generate employee ID
      const autoId = `EMP-${1000 + employees.length + 1}`;
      setEmployeeId(autoId);
      setName('');
      setEmail('');
      setPhone('');
      setDepartment('Billing & Counter');
      setDesignation('Sales & Billing Staff');
      setJoiningDate('02/10/2026');
      setStatus('Active');
      setRoleId(roles[3]?.id || 'role-cashier');
      setSalary(25000);
      setCommissionRatePercent(1.0);
      setAssignedBranch('Main Commercial Market, Bengaluru');
      setGovernmentId('');
      setAddress('');
    }
  }, [selectedEmployee, employees.length, roles]);

  if (!isAddEmployeeModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      showToast('Please fill all required fields');
      return;
    }

    const roleObj = roles.find((r) => r.id === roleId) || roles[0];

    if (selectedEmployee) {
      updateEmployee(selectedEmployee.id, {
        name,
        employeeId,
        email,
        phone,
        department,
        designation,
        joiningDate,
        status,
        roleId: roleObj.id,
        roleName: roleObj.name,
        salary,
        commissionRatePercent,
        assignedBranch,
        governmentId,
        address,
      });
    } else {
      addEmployee({
        employeeId: employeeId || `EMP-${1000 + employees.length + 1}`,
        name,
        email,
        phone,
        department,
        designation,
        joiningDate,
        status,
        roleId: roleObj.id,
        roleName: roleObj.name,
        salary,
        commissionRatePercent,
        totalSalesAchieved: 0,
        totalCommissionEarned: 0,
        ordersHandled: 0,
        rating: 5.0,
        assignedBranch,
        governmentId,
        address,
      });
    }

    setIsAddEmployeeModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold tracking-tight">
              {selectedEmployee ? 'Edit Employee Profile' : 'Add New Staff Member'}
            </h2>
          </div>
          <button
            onClick={() => setIsAddEmployeeModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[80vh] space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Employee ID *</label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP-1007"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ramesh Kumar"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Work Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@krishnaenterprises.com"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Mobile Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98450 12345"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as any)}
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              >
                <option value="Billing & Counter">Billing &amp; Counter</option>
                <option value="Sales & Marketing">Sales &amp; Marketing</option>
                <option value="Accounts & Finance">Accounts &amp; Finance</option>
                <option value="Warehouse & Logistics">Warehouse &amp; Logistics</option>
                <option value="Operations">Operations</option>
                <option value="Procurement">Procurement</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Designation Title</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Lead Billing Specialist"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">System Role</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Joining Date</label>
              <input
                type="text"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                placeholder="02/10/2026"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Employment Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Probation">Probation</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Base Monthly Salary (₹)</label>
              <input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                placeholder="25000"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sales Commission Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={commissionRatePercent}
                onChange={(e) => setCommissionRatePercent(Number(e.target.value))}
                placeholder="1.5"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Aadhaar / Government ID</label>
              <input
                type="text"
                value={governmentId}
                onChange={(e) => setGovernmentId(e.target.value)}
                placeholder="AADHAAR-XXXX-XXXX-XXXX"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assigned Store Branch</label>
              <input
                type="text"
                value={assignedBranch}
                onChange={(e) => setAssignedBranch(e.target.value)}
                placeholder="Main Commercial Market, Bengaluru"
                className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Residential Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Door No, Street, City, State"
              className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddEmployeeModalOpen(false)}
              className="px-4 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
            >
              {selectedEmployee ? 'Save Changes' : 'Create Employee Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
