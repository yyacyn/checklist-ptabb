<?php

namespace App\Enums;

/**
 * Report lifecycle states (SRS section 10, ERD §7.1).
 */
enum ReportStatus: string
{
    case Draft = 'draft';
    case InProgress = 'in_progress';
    case Submitted = 'submitted';
    case Reviewed = 'reviewed';
    case Closed = 'closed';
    case Reopened = 'reopened';

    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::InProgress, self::Reopened], true);
    }

    public function isLocked(): bool
    {
        return in_array($this, [self::Submitted, self::Reviewed, self::Closed], true);
    }

    public function isFinal(): bool
    {
        return $this === self::Closed;
    }
}
