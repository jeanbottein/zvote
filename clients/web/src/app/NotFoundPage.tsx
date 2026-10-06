import { Link } from 'react-router';
import Notice from '../ui/Notice';

export default function NotFoundPage() {
  return (
    <Notice title="Page not found" action={<Link className="button primary" to="/">Back to the home page</Link>}>
      <p>There is nothing at this address.</p>
    </Notice>
  );
}
