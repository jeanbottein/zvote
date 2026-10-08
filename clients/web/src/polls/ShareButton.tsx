import { useState } from 'react';
import type { Poll } from '../api/types';
import { ShareIcon } from '../ui/icons';
import { pollUrl } from './links';
import ShareDialog from './ShareDialog';

interface ShareButtonProps {
  poll: Pick<Poll, 'id' | 'title' | 'visibility' | 'joinCode' | 'invitationOnly'>;
  className?: string;
}

/** The poll's link and join code, to share. */
export default function ShareButton({ poll, className = 'button secondary' }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <ShareIcon /> Share
      </button>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share this poll"
        hint={<>
          {poll.invitationOnly
            ? 'Anyone with the code or the link can see the poll. Only the people you invite can vote.'
            : 'Anyone with the code or the link can vote.'}
          {poll.visibility === 'UNLISTED' && ' The poll is not listed anywhere else.'}
        </>}
        url={pollUrl(poll.id)}
        linkLabel="Link to the poll"
        subject={poll.title}
        joinCode={poll.joinCode}
      />
    </>
  );
}
