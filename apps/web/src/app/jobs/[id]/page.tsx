import JobDetailPage from './JobDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailPage jobId={id} />;
}
