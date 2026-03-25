import { EmployeeManagement } from '@/features/admin/components/employee-management'

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        Employee Management
      </h2>
      <p className="text-sm text-foreground/60">
        Create employees, then search and reassign approval chains as needed.
      </p>
      <EmployeeManagement />
    </div>
  )
}
