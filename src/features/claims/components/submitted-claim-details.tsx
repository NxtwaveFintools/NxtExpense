import type { ClaimWithItems } from '@/features/claims/types'

type SubmittedField = {
  label: string
  value: string
}

function getSubmittedFields(claim: ClaimWithItems['claim']): SubmittedField[] {
  const fields: Array<SubmittedField | null> = [
    claim.has_intercity_travel
      ? {
          label: 'Inter-city Travel',
          value: 'Yes',
        }
      : null,
    claim.has_intercity_travel
      ? {
          label: 'Inter-city Own Vehicle',
          value: claim.intercity_own_vehicle_used ? 'Yes' : 'No',
        }
      : null,
    claim.has_intracity_travel
      ? {
          label: 'Intra-city Travel',
          value: 'Yes',
        }
      : null,
    claim.has_intracity_travel
      ? {
          label: 'Intra-city Own Vehicle',
          value: claim.intracity_own_vehicle_used ? 'Yes' : 'No',
        }
      : null,
    claim.outstation_state_name
      ? {
          label: 'State',
          value: claim.outstation_state_name,
        }
      : null,
    claim.outstation_city_name
      ? {
          label: 'Intra-city City',
          value: claim.outstation_city_name,
        }
      : null,
    claim.own_vehicle_used === null
      ? null
      : {
          label: 'Own vehicle used?',
          value: claim.own_vehicle_used ? 'Yes' : 'No',
        },
    claim.vehicle_type
      ? {
          label: 'Vehicle Type',
          value: claim.vehicle_type,
        }
      : null,
    claim.from_city_name
      ? {
          label: 'From City',
          value: claim.from_city_name,
        }
      : null,
    claim.to_city_name
      ? {
          label: 'To City',
          value: claim.to_city_name,
        }
      : null,
    claim.km_travelled === null
      ? null
      : {
          label: 'KM Travelled',
          value: `${Number(claim.km_travelled).toFixed(2)} KM`,
        },
    claim.accommodation_nights && claim.accommodation_nights > 0
      ? {
          label: 'Accommodation Nights',
          value: String(claim.accommodation_nights),
        }
      : null,
    claim.food_with_principals_amount && claim.food_with_principals_amount > 0
      ? {
          label: 'Food with Principals',
          value: `Rs. ${Number(claim.food_with_principals_amount).toFixed(2)}`,
        }
      : null,
  ]

  return fields.filter((field): field is SubmittedField => field !== null)
}

type SubmittedClaimDetailsProps = {
  claim: ClaimWithItems['claim']
}

export function SubmittedClaimDetails({ claim }: SubmittedClaimDetailsProps) {
  const submittedFields = getSubmittedFields(claim)

  if (submittedFields.length === 0) {
    return null
  }

  return (
    <>
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Submitted Details
      </h3>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        {submittedFields.map((field) => (
          <div
            key={field.label}
            className="space-y-1 rounded-md border border-border bg-background p-4"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {field.label}
            </dt>
            <dd className="font-medium">{field.value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
