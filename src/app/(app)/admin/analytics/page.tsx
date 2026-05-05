import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Admin Analytics' }

export default function AdminAnalyticsPage() {
  redirect('/dashboard')
}
