'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createEmployeeAction,
  getApproverOptionsByStateAction,
  getEmployeeFormOptionsAction,
} from '@/features/admin/actions'
import type { AdminEmployeeFormOptions } from '@/features/admin/types'

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

export function EmployeeCreateForm({
  onCreated,
  replacementDraft = null,
  onReplacementCompleted,
}: EmployeeCreateFormProps) {
  const [options, setOptions] = useState<AdminEmployeeFormOptions | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingApprovers, setIsLoadingApprovers] = useState(false)
  const [enablePasswordLogin, setEnablePasswordLogin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE)
  const [approversByLevel, setApproversByLevel] = useState<
    AdminEmployeeFormOptions['approversByLevel']
  >({
    level1: [],
    level2: [],
    level3: [],
  })

  const isReplacementMode = Boolean(replacementDraft)

  const loadFormOptions = useCallback(async () => {
    if (options || isLoadingOptions) {
      return
    }

    setIsLoadingOptions(true)
    const result = await getEmployeeFormOptionsAction()
    setIsLoadingOptions(false)

    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? 'Failed to load employee form options.')
      return
    }

    setOptions(result.data)
    setErrorMessage(null)
  }, [isLoadingOptions, options])

  async function handleToggleForm() {
    if (isFormVisible) {
      setIsFormVisible(false)
      return
    }

    setIsFormVisible(true)
    await loadFormOptions()
  }

  useEffect(() => {
    if (!isReplacementMode || options || isLoadingOptions) {
      return
    }

    queueMicrotask(() => {
      void loadFormOptions()
    })
  }, [isReplacementMode, options, isLoadingOptions, loadFormOptions])

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

  useEffect(() => {
    let isMounted = true

    const effectiveStateId =
      form.stateId || replacementDraft?.defaultStateId || ''

    async function loadApproversForState() {
      if (!effectiveStateId) {
        setApproversByLevel({ level1: [], level2: [], level3: [] })
        return
      }

      setIsLoadingApprovers(true)
      const result = await getApproverOptionsByStateAction(effectiveStateId)

      if (!isMounted) {
        return
      }

      setIsLoadingApprovers(false)

      if (!result.ok || !result.data) {
        setApproversByLevel({ level1: [], level2: [], level3: [] })
        setErrorMessage(result.error ?? 'Failed to load approver options.')
        return
      }

      setApproversByLevel(result.data)
      setErrorMessage(null)
    }

    loadApproversForState()

    return () => {
      isMounted = false
    }
  }, [form.stateId, replacementDraft?.defaultStateId])

  const replacementActiveStatusId =
    options?.statuses.find((status) => status.status_code === 'ACTIVE')?.id ??
    ''

  const selectedDesignationId =
    form.designationId || replacementDraft?.defaultDesignationId || ''
  const selectedRoleId = form.roleId || replacementDraft?.defaultRoleId || ''
  const selectedStateId = form.stateId || replacementDraft?.defaultStateId || ''
  const selectedEmployeeStatusId =
    form.employeeStatusId ||
    (isReplacementMode ? replacementActiveStatusId : '')

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

      {errorMessage && (
        <p className="mt-4 rounded-md border border-error/20 bg-error-light px-3 py-2 text-sm text-error">
          {errorMessage}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-medium text-foreground">
              Employee ID
              <input
                required
                value={form.employeeId}
                onChange={(event) =>
                  setField('employeeId', event.currentTarget.value)
                }
                className={`${inputClassName} mt-1`}
                placeholder="e.g. NXT-EMP-1001"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              Full Name
              <input
                required
                value={form.employeeName}
                onChange={(event) =>
                  setField('employeeName', event.currentTarget.value)
                }
                className={`${inputClassName} mt-1`}
                placeholder="Employee full name"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              Email
              <input
                required
                type="email"
                value={form.employeeEmail}
                onChange={(event) =>
                  setField('employeeEmail', event.currentTarget.value)
                }
                className={`${inputClassName} mt-1`}
                placeholder="name@nxtwave.co.in"
              />
            </label>

            <div className="block text-sm font-medium text-foreground">
              Create Password Login Account
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEnablePasswordLogin(true)
                  }}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    enablePasswordLogin
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnablePasswordLogin(false)
                    setField('loginPassword', '')
                  }}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    !enablePasswordLogin
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  No
                </button>
              </div>
              {enablePasswordLogin ? (
                <input
                  type="password"
                  value={form.loginPassword}
                  onChange={(event) =>
                    setField('loginPassword', event.currentTarget.value)
                  }
                  className={`${inputClassName} mt-2`}
                  placeholder="Set password for email login"
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                />
              ) : null}
            </div>

            <label className="block text-sm font-medium text-foreground">
              Designation
              <select
                required
                value={selectedDesignationId}
                onChange={(event) =>
                  setField('designationId', event.currentTarget.value)
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">Select designation</option>
                {options?.designations.map((designation) => (
                  <option key={designation.id} value={designation.id}>
                    {designation.designation_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Employee Status
              <select
                required
                value={selectedEmployeeStatusId}
                onChange={(event) =>
                  setField('employeeStatusId', event.currentTarget.value)
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">Select status</option>
                {options?.statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.status_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Role
              <select
                required
                value={selectedRoleId}
                onChange={(event) =>
                  setField('roleId', event.currentTarget.value)
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">Select role</option>
                {options?.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-foreground sm:col-span-2 lg:col-span-1">
              Primary State
              <select
                required
                value={selectedStateId}
                onChange={(event) =>
                  setField('stateId', event.currentTarget.value)
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">Select state</option>
                {options?.states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.state_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-foreground">
              Level 1 Approver (optional)
              <select
                value={form.approvalEmployeeIdLevel1}
                onChange={(event) =>
                  setField(
                    'approvalEmployeeIdLevel1',
                    event.currentTarget.value
                  )
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">None</option>
                {level1Options.map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Level 2 Approver (optional)
              <select
                value={form.approvalEmployeeIdLevel2}
                onChange={(event) =>
                  setField(
                    'approvalEmployeeIdLevel2',
                    event.currentTarget.value
                  )
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">None</option>
                {level2Options.map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Level 3 Approver (optional)
              <select
                value={form.approvalEmployeeIdLevel3}
                onChange={(event) =>
                  setField(
                    'approvalEmployeeIdLevel3',
                    event.currentTarget.value
                  )
                }
                className={`${selectClassName} mt-1`}
              >
                <option value="">None</option>
                {level3Options.map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.stateId &&
            !isLoadingApprovers &&
            level1Options.length === 0 && (
              <p className="text-sm text-amber-600">
                No eligible Level 1 approver found for this state.
                {ruleLabelsByLevel.level1.length > 0
                  ? ` Expected designation: ${ruleLabelsByLevel.level1.join(', ')}.`
                  : ''}
              </p>
            )}

          {form.stateId &&
            !isLoadingApprovers &&
            level2Options.length === 0 && (
              <p className="text-sm text-amber-600">
                No eligible Level 2 approver found for this state.
                {ruleLabelsByLevel.level2.length > 0
                  ? ` Expected designation: ${ruleLabelsByLevel.level2.join(', ')}.`
                  : ''}
              </p>
            )}

          {form.stateId &&
            !isLoadingApprovers &&
            level3Options.length === 0 && (
              <p className="text-sm text-amber-600">
                No eligible Level 3 approver found.
                {ruleLabelsByLevel.level3.length > 0
                  ? ` Expected designation: ${ruleLabelsByLevel.level3.join(', ')}.`
                  : ''}
              </p>
            )}

          {form.stateId && isLoadingApprovers && (
            <p className="text-sm text-muted-foreground">
              Loading approvers for selected state...
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      ) : null}

      {(isFormVisible || isReplacementMode) && !isLoadingOptions && !options ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={loadFormOptions}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Retry Loading Form
          </button>
        </div>
      ) : null}
    </section>
  )
}
