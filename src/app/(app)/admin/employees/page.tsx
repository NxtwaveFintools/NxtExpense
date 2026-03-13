import { EmployeeManagement } from '@/features/admin/components/employee-management'

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        Employee Management
      </h2>
      <p className="text-sm text-foreground/60">
        Search employees to view details or reassign their approval chain.
      </p>
      <EmployeeManagement />
    </div>
  )
}
