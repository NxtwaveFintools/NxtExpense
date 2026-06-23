'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createEmployeeAction,
  getApproverOptionsByStateAction,
  getEmployeeFormOptionsAction,
} from '@/features/admin/actions'
import { confirmAdminAction } from '@/features/admin/components/confirm-admin-action'
import { EMPLOYEE_STATUS_CODES } from '@/lib/constants/claim-expense'
import { QUERY_GC_TIME, QUERY_STALE_TIME } from '@/lib/constants/query-config'
import type { AdminEmployeeFormOptions } from '@/features/admin/types'
import { EmployeeFormFields } from './employee-form-fields'

type ReplacementDraft = {
  oldEmployeeId: string
  oldEmployeeName: string
  defaultDesignationId: string | null
  defaultRoleId: string | null
  defaultStateId: string | null
  reason: string
}

type EmployeeCreateFormProps = {
  onCreated: () => void
  replacementDraft?: ReplacementDraft | null
  onReplacementCompleted?: () => void
}

type FormState = {
  employeeId: string
  employeeName: string
  employeeEmail: string
  loginPassword: string
  designationId: string
  employeeStatusId: string
  roleId: string
  stateId: string
  approvalEmployeeIdLevel1: string
  approvalEmployeeIdLevel2: string
  approvalEmployeeIdLevel3: string
}

const INITIAL_FORM_STATE: FormState = {
  employeeId: '',
  employeeName: '',
  employeeEmail: '',
  loginPassword: '',
  designationId: '',
  employeeStatusId: '',
  roleId: '',
  stateId: '',
  approvalEmployeeIdLevel1: '',
  approvalEmployeeIdLevel2: '',
  approvalEmployeeIdLevel3: '',
}

const inputClassName =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground'

const selectClassName =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'

const EMPTY_APPROVERS_BY_LEVEL: AdminEmployeeFormOptions['approversByLevel'] = {
  level1: [],
  level2: [],
  level3: [],
}

export function EmployeeCreateForm({
  onCreated,
  replacementDraft = null,
  onReplacementCompleted,
}: EmployeeCreateFormProps) {
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enablePasswordLogin, setEnablePasswordLogin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE)

  const isReplacementMode = Boolean(replacementDraft)
  const shouldLoadOptions = isFormVisible || isReplacementMode
  const effectiveStateId =
    form.stateId || replacementDraft?.defaultStateId || ''

  const formOptionsQuery = useQuery<AdminEmployeeFormOptions, Error>({
    queryKey: ['admin-employee-form-options'],
    queryFn: async () => {
      const result = await getEmployeeFormOptionsAction()

      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Failed to load employee form options.')
      }

      return result.data
    },
    enabled: shouldLoadOptions,
    gcTime: QUERY_GC_TIME.MEDIUM,
  })

  const options = formOptionsQuery.data ?? null
  const isLoadingOptions =
    shouldLoadOptions && !options && formOptionsQuery.isFetching

  const approversQuery = useQuery<
    AdminEmployeeFormOptions['approversByLevel'],
    Error
  >({
    queryKey: ['admin-approvers-by-state', effectiveStateId],
    queryFn: async () => {
      const result = await getApproverOptionsByStateAction(effectiveStateId)

      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Failed to load approver options.')
      }

      return result.data
    },
    enabled: shouldLoadOptions && Boolean(options) && Boolean(effectiveStateId),
    staleTime: QUERY_STALE_TIME.REALTIME,
    gcTime: QUERY_GC_TIME.MEDIUM,
  })

  const approversByLevel = approversQuery.data ?? EMPTY_APPROVERS_BY_LEVEL
  const isLoadingApprovers = approversQuery.isFetching

  function handleToggleForm() {
    if (isFormVisible) {
      setIsFormVisible(false)
      return
    }

    setIsFormVisible(true)
  }

  const level1Options = useMemo(
    () =>
      approversByLevel.level1.map((approver) => ({
        id: approver.id,
        label: `${approver.employee_name} (${approver.employee_email})`,
      })),
    [approversByLevel.level1]
  )

  const level2Options = useMemo(
    () =>
      approversByLevel.level2.map((approver) => ({
        id: approver.id,
        label: `${approver.employee_name} (${approver.employee_email})`,
      })),
    [approversByLevel.level2]
  )

  const level3Options = useMemo(
    () =>
      approversByLevel.level3.map((approver) => ({
        id: approver.id,
        label: `${approver.employee_name} (${approver.employee_email})`,
      })),
    [approversByLevel.level3]
  )

  const ruleLabelsByLevel = options?.approverRuleLabelsByLevel ?? {
    level1: [],
    level2: [],
    level3: [],
  }

  const replacementActiveStatusId =
    options?.statuses.find(
      (status) => status.status_code === EMPLOYEE_STATUS_CODES.ACTIVE
    )?.id ?? ''

  const selectedDesignationId =
    form.designationId || replacementDraft?.defaultDesignationId || ''
  const selectedRoleId = form.roleId || replacementDraft?.defaultRoleId || ''
  const selectedStateId = form.stateId || replacementDraft?.defaultStateId || ''
  const selectedEmployeeStatusId =
    form.employeeStatusId ||
    (isReplacementMode ? replacementActiveStatusId : '')

  const resolvedErrorMessage =
    errorMessage ??
    (formOptionsQuery.isError
      ? formOptionsQuery.error.message
      : approversQuery.isError
        ? approversQuery.error.message
        : null)

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => {
      if (field === 'stateId' && current.stateId !== value) {
        return {
          ...current,
          stateId: value,
          approvalEmployeeIdLevel1: '',
          approvalEmployeeIdLevel2: '',
          approvalEmployeeIdLevel3: '',
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const isConfirmed = await confirmAdminAction(
      replacementDraft
        ? `Create replacement employee for "${replacementDraft.oldEmployeeName}"?`
        : 'Create this employee record?'
    )

    if (!isConfirmed) {
      return
    }

    setIsSubmitting(true)
    const result = await createEmployeeAction({
      ...form,
      loginPassword: enablePasswordLogin ? form.loginPassword : '',
      designationId: selectedDesignationId,
      roleId: selectedRoleId,
      stateId: selectedStateId,
      employeeStatusId: selectedEmployeeStatusId,
      replacementEmployeeId: replacementDraft?.oldEmployeeId ?? '',
      replacementReason: replacementDraft?.reason ?? '',
      replacementConfirmation: replacementDraft ? 'CONFIRM' : undefined,
    })
    setIsSubmitting(false)

    if (!result.ok) {
      setErrorMessage(result.error ?? 'Unable to create employee.')
      toast.error(result.error ?? 'Unable to create employee.')
      return
    }

    toast.success(
      `Employee created: ${result.employee?.employee_name ?? form.employeeName}`
    )
    setForm(INITIAL_FORM_STATE)
    setIsFormVisible(false)
    setEnablePasswordLogin(false)
    if (replacementDraft && onReplacementCompleted) {
      onReplacementCompleted()
    }
    onCreated()
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Add Employee
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {replacementDraft
              ? `Creating replacement for ${replacementDraft.oldEmployeeName}.`
              : 'Creates employee, primary state, and role assignment in one action.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleForm}
          disabled={isReplacementMode}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Plus className="size-4" />
          {isReplacementMode
            ? 'Replacement Form Active'
            : isFormVisible
              ? 'Hide Form'
              : 'Add Employee'}
        </button>
      </div>

      {resolvedErrorMessage && (
        <p className="mt-4 rounded-md border border-error/20 bg-error-light px-3 py-2 text-sm text-error">
          {resolvedErrorMessage}
        </p>
      )}

      {(isFormVisible || isReplacementMode) && isLoadingOptions ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Preparing employee form...
        </div>
      ) : null}

      {(isFormVisible || isReplacementMode) && !isLoadingOptions && options ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <EmployeeFormFields
            form={form}
            options={options}
            selectedDesignationId={selectedDesignationId}
            selectedRoleId={selectedRoleId}
            selectedStateId={selectedStateId}
            selectedEmployeeStatusId={selectedEmployeeStatusId}
            enablePasswordLogin={enablePasswordLogin}
            isSubmitting={isSubmitting}
            isLoadingApprovers={isLoadingApprovers}
            level1Options={level1Options}
            level2Options={level2Options}
            level3Options={level3Options}
            ruleLabelsByLevel={ruleLabelsByLevel}
            inputClassName={inputClassName}
            selectClassName={selectClassName}
            onFieldChange={setField}
            onTogglePasswordLogin={(enabled) => {
              setEnablePasswordLogin(enabled)
              if (!enabled) setField('loginPassword', '')
            }}
          />
        </form>
      ) : null}

      {(isFormVisible || isReplacementMode) && !isLoadingOptions && !options ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void formOptionsQuery.refetch()
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Retry Loading Form
          </button>
        </div>
      ) : null}
    </section>
  )
}
