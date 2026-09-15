import { importDependencies, importProjects, importRoles } from "./actions";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

const ROLES_SAMPLE = `name,description,order,active,defaultCapacity
Project Manager,,0,true,5
Business Analyst,,1,true,2
Architect,,2,true,5
Developer,,3,true,5
QA Engineer,,4,true,5
DevOps Engineer,,5,true,5`;

const PROJECTS_SAMPLE = `code,name,description,priority,status,constraint,constraintMonth
PRJ-001,Customer Portal Refresh,,1,ACTIVE,MUST_START,2026-09
PRJ-002,Data Warehouse Modernization,,2,PLANNED,ASAP,
PRJ-003,Mobile App v2,,2,PLANNED,MUST_FINISH,2027-09
PRJ-004,Legal Contract Automation,,3,PLANNED,ASAP,`;

const DEPS_SAMPLE = `dependentCode,dependsOnCode,type,lagMonths,note
PRJ-003,PRJ-001,FS,0,Mobile depends on Portal launch
PRJ-004,PRJ-002,SS,1,Legal starts one month into DWH
PRJ-002,PRJ-001,FF,0,Both wrap together`;

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import from CSV</h1>
        <p className="text-sm text-slate-500">
          Upload a CSV to bulk-create or update records. Existing rows are matched by
          <span className="font-medium"> name</span> (roles) or{" "}
          <span className="font-medium">code</span> (projects) and{" "}
          <em>overwritten</em>. Unknown rows are created. Phases, demand, resources, and
          assignments are not imported here.
        </p>
      </div>

      <ImportForm
        title="Roles"
        helpText="Columns: name (required), description, order, active, defaultCapacity. Match key: name."
        sample={ROLES_SAMPLE}
        action={importRoles}
      />

      <ImportForm
        title="Projects"
        helpText="Columns: code (required), name (required), description, priority (1–5), status (PLANNED/ACTIVE/ON_HOLD/COMPLETE/CANCELLED), constraint (ASAP/MUST_START/MUST_FINISH), constraintMonth (YYYY-MM, required unless ASAP). Match key: code."
        sample={PROJECTS_SAMPLE}
        action={importProjects}
      />

      <ImportForm
        title="Dependencies"
        helpText="Columns: dependentCode (required), dependsOnCode (required), type (FS/SS/FF/SF, default FS), lagMonths (integer, may be negative), note. Match key: (dependentCode, dependsOnCode). Both project codes must already exist — import Projects first."
        sample={DEPS_SAMPLE}
        action={importDependencies}
      />
    </div>
  );
}
