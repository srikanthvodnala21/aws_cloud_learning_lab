# AWS Cloud Learning Lab

An interactive website for learning how AWS works. Each module explains its concepts, shows step-by-step animations of what happens behind the scenes, and includes a hands-on simulator you can break and fix.

**Everything runs in your browser.** There is no backend and no database, no AWS account or credentials are needed, and no paid APIs are used. Nothing in the lab calls AWS: every experiment is a local simulation with simplified logic.

> Educational project. Not affiliated with or endorsed by Amazon Web Services. Prices shown are **sample** values for learning; use the [official AWS Pricing Calculator](https://calculator.aws/) for real estimates.

---

## What's inside

| Area | What you get |
| --- | --- |
| **Dashboard** | Progress, current learning path, recommended next modules, recently explored, experiments checklist |
| **16 learning modules** | Cloud fundamentals, Global infrastructure, IAM, EC2, VPC, S3, Load balancing & Auto Scaling, Route 53, Databases, Serverless, Monitoring, Messaging, Security, Containers, Advanced networking, DevOps/CI-CD |
| **Animations** | Every animation can play, pause, restart, step forwards/backwards and run at ¼×–2× speed (slow motion), with narration and an event log |
| **16 simulators** | One per module (see below) |
| **Architecture Playground** | Drag-and-drop canvas (React Flow) with ~27 AWS components. Connect components, simulate traffic, fail them, see the request path, detect single points of failure, use templates, save to localStorage, export/import JSON |
| **Scenario Lab** | 8 real-world architectures, each animated and ending with a failure scenario, plus components, cost drivers, security notes and tasks |
| **Service comparisons** | 10 side-by-side comparisons with diagrams and decision tables |
| **Cost Explorer** | Monthly estimate with breakdown charts, purchase-option comparison and clearly labelled sample prices |
| **Quizzes** | A quiz per module that explains why each wrong answer is wrong as well as why the right one is right |
| **Search** | ⌘K / Ctrl-K or `/` to search modules, concepts, services, scenarios and comparisons |
| **Themes** | Dark (default) and light, remembered per browser |

### Simulators by module

1. **Cloud scaling:** on-premises fixed capacity vs elastic cloud capacity, with demand patterns and a 3-year cost curve.
2. **Region & AZ explorer:** map of Regions, AZ layouts, deploying across 1–3 AZs, failing an AZ, and latency from user locations.
3. **IAM policy simulator:** editable JSON policy evaluated with the real order: explicit deny → allow → implicit deny. Supports wildcards, `NotAction`/`NotResource` and MFA conditions.
4. **EC2 launch simulator:** instance-type picker, security-group rules, launch lifecycle, stop/start (public IP changes), Elastic IP, hardware failure and recovery, and connectivity tests.
5. **VPC lab:**
   - Packet-path tester that uses real CIDR longest-prefix matching, stateless ordered NACLs, stateful security groups (including SG references), IGW and NAT. A "break something" menu introduces faults.
   - Drag-and-drop VPC builder that validates your design.
6. **S3 simulator:** bucket-name validation, versioning and delete markers, storage-class columns, lifecycle rules with time travel, and Glacier restore.
7. **Load balancer & Auto Scaling:** live traffic, round robin vs least outstanding requests, health-check thresholds, AZ failure and target tracking, with charts.
8. **Route 53 DNS:** editable hosted zone (A, AAAA, CNAME, ALIAS) with simple, weighted, failover and latency policies, resolver cache and TTLs, plus validation (for example, no CNAME at the apex).
9. **Databases:**
   - RDS Multi-AZ failover, read-replica lag and stale reads, and promoting a replica.
   - DynamoDB GetItem / Query / Scan across partitions, plus SQL JOIN vs single-table design.
10. **Lambda:** concurrency, cold starts, provisioned and reserved concurrency, throttling, memory vs duration and cost, and event triggers with sample payloads.
11. **CloudWatch:** live metrics with injected incidents, alarms (M of N datapoints) delivering to an SNS inbox, logs with metric filters, CloudTrail history, and a CloudWatch / CloudTrail / Config comparison.
12. **Messaging:**
    - SQS with visibility timeout, duplicates, poison messages, DLQ and FIFO groups.
    - SNS fan-out with filter policies.
    - An EventBridge pattern matcher.
13. **Security:** shared-responsibility stacks per service, a clickable defence-in-depth map, and a threat simulator that shows which control blocks which attack.
14. **Containers:**
    - Who manages what for EC2, ECS, Fargate and EKS, with deployment animations.
    - A mini Kubernetes cluster with rolling updates, pod kills and node failures.
15. **Connectivity:** VPC peering (non-transitive, overlapping CIDRs) vs Transit Gateway (hub and spoke, segmentation), plus a VPN / Direct Connect chooser.
16. **CI/CD:** a pipeline run with failure injection, manual approval and automatic rollback, plus a visualiser comparing all-at-once, rolling, blue/green and canary deployments.

---

## Tech stack

- [Vite](https://vite.dev/) + [React 18](https://react.dev/) + TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com/) (theme tokens in `src/styles/index.css`)
- [React Flow (@xyflow/react)](https://reactflow.dev/) for the Playground and the VPC builder
- [Recharts](https://recharts.org/) for charts, [Framer Motion](https://motion.dev/) for layout animations, [lucide-react](https://lucide.dev/) for icons
- A custom SVG animation engine (`src/animation`) for the step-by-step diagrams
- `HashRouter` routing, so refreshes and deep links work on GitHub Pages

---

## Run locally

Requirements: **Node.js 20 or newer** (22 LTS recommended) and npm.

```bash
cd aws_cloud_learning_lab
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173/).

Other scripts:

```bash
npm run typecheck   # TypeScript check only
npm run build       # type-check + production build into dist/
npm run preview     # serve the production build locally (http://localhost:4173/)
```

## Build for production

```bash
npm run build
```

The output goes to `dist/`. By default the build uses a **relative base (`./`)**, so you can open `dist/` from any static server or folder.

For GitHub Pages, the workflow sets `BASE_PATH` to the repository sub-path. To reproduce that locally:

```bash
BASE_PATH=/aws_cloud_learning_lab/ npm run build
```

Every asset URL is then prefixed with `/aws_cloud_learning_lab/`.

---

## Deploy to GitHub Pages

The repository already contains `.github/workflows/deploy.yml`. On every push to `main` it:

1. Runs `npm ci`.
2. Runs `npm run build` with `BASE_PATH=/<repository-name>/`. The repository name is filled in automatically, so you don't need to edit anything.
3. Copies `index.html` to `404.html` and adds `.nojekyll`.
4. Uploads `dist/` and deploys it with `actions/deploy-pages`.

### 1. Create the GitHub repository

On GitHub, click **New repository** and name it, for example, `aws_cloud_learning_lab`. Don't add a README, `.gitignore` or licence, because this project already has them.

### 2. Push the code

```bash
cd aws_cloud_learning_lab
git init
git add .
git commit -m "AWS Cloud Learning Lab"
git branch -M main
git remote add origin https://github.com/<your-username>/aws_cloud_learning_lab.git
git push -u origin main
```

(`node_modules/` and `dist/` are excluded by `.gitignore`.)

### 3. Configure GitHub Pages

In the repository, go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. You only need to do this once.

### 4. Deploy

The push in step 2 already triggered the workflow. Open the **Actions** tab and watch the **Deploy to GitHub Pages** run. If it ran before you configured Pages and failed, open the run and click **Re-run all jobs**. You can also start it manually with **Run workflow** (`workflow_dispatch`).

When it finishes, the site is live at:

```
https://<your-username>.github.io/aws_cloud_learning_lab/
```

Deep links look like `…/aws_cloud_learning_lab/#/modules/vpc`. Because the app uses hash routing, refreshing any page works.

> **User or organisation site?** If you deploy to a repository named `<your-username>.github.io` (served from the domain root), change the build step's env to `BASE_PATH: /` in `.github/workflows/deploy.yml`.

### 5. Update the site later

Edit, commit and push to `main`. The workflow rebuilds and redeploys automatically:

```bash
git add .
git commit -m "Improve S3 module"
git push
```

---

## Project structure

```
src/
  animation/        Animation engine: FlowDef types, SVG FlowCanvas/FlowPlayer, timeline + playback controls
  components/       UI kit (cards, callouts, tabs, sliders, code blocks), Quiz, icons, layout (sidebar, search)
  content/
    modules/        The 16 learning modules (concepts, animations, quizzes, code, docs) – one file each
    roadmap.ts      Learning roadmap stages
  data/             Service catalog (with global/regional/zonal scope), comparisons, scenarios, sample pricing
  experiments/      One interactive simulator per module (lazy-loaded via registry.ts)
  simulations/      Pure logic engines: IAM policy evaluator, VPC routing/NACL/SG engine, EventBridge pattern matcher
  playground/       Architecture Playground catalog + drag-and-drop VPC builder
  pages/            Routes: Dashboard, Modules, Module, Roadmap, Playground, Scenarios, Compare, Cost, Services
  store/            Progress store (localStorage key: aws-lab-progress-v1)
  styles/           Tailwind v4 theme (dark + light tokens)
```

### Adding or editing content

- **Module text, quizzes, animations:** edit `src/content/modules/mXX-*.ts`. Animations are plain data (`FlowDef`): nodes, edges and steps with packets, focus and status changes. They are built with helpers from `src/animation/builders.ts`.
- **New simulator:** add a component in `src/experiments/`, register it in `src/experiments/registry.ts`, and reference its key in the module's `experiment` field.
- **Prices:** all sample prices live in `src/data/pricing.ts`.

## Saved data

Progress is stored only in your browser's `localStorage`. There is no account, no sign-up and no tracking. Saved data includes:

- completed modules
- visited modules
- completed experiments
- best quiz scores
- theme
- your saved Playground design

Use **Reset progress** on the Dashboard, or clear site data, to start over.

## Accuracy notes

- Terminology follows AWS documentation. The Service Catalog marks every service as **global**, **regional** or **zonal**.
- Simulators simplify real behaviour so the important mechanism is visible. Each one carries a "Simulation" label, and the limits are explained in context. For example, the IAM simulator lists what real IAM also evaluates (SCPs, RCPs, permissions boundaries, session and resource policies).
- Pricing is illustrative: approximate us-east-1 Linux list prices at a point in time. The assumptions are listed on the Cost Explorer page.
