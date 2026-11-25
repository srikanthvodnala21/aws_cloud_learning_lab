import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <div className="text-6xl font-bold text-accent">404</div>
      <p className="mt-3 text-muted">This page does not exist in the lab (no AWS resources were harmed).</p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
