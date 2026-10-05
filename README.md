# Joel's dashboard

A searchable, self-tidying dashboard for graduate applications, rejections, LinkedIn progress, deadlines, lectures, shifts, driving and current research. Plain HTML and one JSON file. No build step, no dependencies.

```
index.html                     the dashboard and its search
data/data.json                 everything the page shows (the only file you edit)
data/archive.json              old events, deadlines and updates, moved here automatically
scripts/update.mjs             validates the data, archives old items, refreshes counts
.github/workflows/update.yml   runs the script daily and on every change to data.json
vercel.json                    headers (no caching of data, no search-engine indexing)
```

## Before you publish: privacy

This file holds personal details: applications and rejections, your shifts, lesson times and your driving test. 

- Make the GitHub repository **private**.
- A Vercel deployment is reachable by anyone with the link unless you turn on deployment protection for the project (Project Settings, Deployment Protection). Check which protection options your Vercel plan includes. If you cannot protect it, remove the details you would not want a stranger to read before you deploy.
- `vercel.json` and a meta tag ask search engines not to index the site. That is a request, not a lock.

## Set it up

1. Create a **private** repository on GitHub and push this folder to it.
2. In Vercel choose Add New, Project, import the repository. Framework preset: Other. Leave build and output settings empty. Deploy.
3. In the repository, open Settings, Actions, General, and under Workflow permissions choose Read and write permissions. The daily job needs this to commit its tidy-ups.

From then on, every commit to `main` redeploys the site.

To look at it locally: `npm run dev` (or `npx serve .`) and open the address it prints. Opening `index.html` straight from a folder will not work, because browsers block reading `data/data.json` from a file address.

## How it stays up to date

Automatic:
- Anything that depends on today's date is worked out in the browser: days left on a deadline, what is coming up in the next 14 days, which lesson is next. The page re-reads `data/data.json` every five minutes and when you return to the tab.
- Each day at 05:17 UTC, and whenever `data/data.json` changes, the GitHub Action runs `scripts/update.mjs`. It checks the data is valid, moves events and deadlines that ended 14 or more days ago (and updates beyond the newest 40) into `data/archive.json`, and refreshes the counts. It commits only if something changed, and Vercel redeploys on that commit.
- If the data is malformed the Action fails and tells you which row and field are wrong.

Not automatic: new applications, rejections, shifts, lessons and research topics. Those only appear when someone adds them to `data/data.json`. Ways to do that:
- Edit the file on GitHub and commit.
- Ask Claude for a fresh export of the dashboard data and paste it over `data/data.json`.
- Work with Claude Code in this repository and ask it to add rows; it can edit `data/data.json` and push.

The claude.ai dashboard page and this repository are separate copies of the same data. Updating one does not update the other.

## Search

Type in the search box, or press `/` to jump to it and Esc to clear it. Every word you type must appear somewhere in an item, in any order. It searches applications (company, role, status, notes), deadlines, lectures, seminars, shifts, lessons, research and recent updates. While you search, "Coming up" widens from 14 days to every future item.

Examples: `mott`, `rejected`, `ebus301 seminar`, `speke`, `online tests`.

## Editing data/data.json

Each section is a list of rows with a unique `id`. Dates are `YYYY-MM-DD`, times are `YYYY-MM-DDTHH:MM` in UK time.

| Section | Fields |
| --- | --- |
| `applications` | `company`, `role`, `location`, `appliedOn`, `rejectedOn`, `note`, `status` (applied, tests, video, ac, final, offer, rejected, withdrawn) |
| `events` | `kind` (shift, lecture, seminar, driving), `title`, `note`, `start`, `end`, optional `test: true` for the driving test |
| `deadlines` | `title`, `module`, `weight`, `words`, `due`, optional `allDay: true` |
| `research` | `title`, `summary`, `tags`, `notes`, `updatedAt` |
| `activity` | `text`, `at` |
| `stats.linkedin` | `count`, `goal`, `approx`, `asOf` |

Run `node scripts/update.mjs` before you commit to catch typos. 

## Limits to know about

- Shifts are your contracted minimum. If your rota changes, update the `shift-` rows.
- Lectures and seminars are loaded for weeks 2 to 6 of semester 1 only. The rest of the semester is not in the file yet.
- Times are written without a time zone and read as the viewer's local time, which is right for UK use.
