# Host INI values (cPanel)

Recorded values from the production host. These are **inherited and cannot be changed per
account or per domain**, so the application is designed to fit inside whatever they are
(SRS 13.1). Do not design against raised values; design against the values below.

Record the real numbers here before running spikes S2 and S3.

| Setting | Value on host | Design consequence |
| --- | --- | --- |
| PHP version | 8.8 | Satisfies Laravel 13 (`php ^8.3`) |
| `upload_max_filesize` | _not yet recorded_ | Browser must resize before upload; target under 1 MB on the wire |
| `post_max_size` | _not yet recorded_ | Must be larger than the resized file |
| `memory_limit` | _not yet recorded_ | Bounds the image optimiser and the PDF job |
| `max_execution_time` | _not yet recorded_ | Bounds any request; long work is queued |
| `max_input_vars` | _not yet recorded_ | Answers save one at a time, never a whole chapter |
| Image backend | _not yet recorded (GD or Imagick)_ | HEIC support depends on this |
| Cron granularity | _not yet recorded_ | Queue worker cadence |
| Disk quota / inodes | _not yet recorded_ | Photo and thumbnail budget (IMG-8) |
| SSH access | _not yet recorded_ | Determines the deployment route |

## How to record them

Any script reachable through the web root, or `php artisan about` output, prints the values.
Delete the script afterwards.
