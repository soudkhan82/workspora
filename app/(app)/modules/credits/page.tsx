"use client";

export default function CreditsPage() {
  return (
    <div className="px-[120px] py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-950">Credits</h1>
        <p className="mt-2 text-sm text-slate-600">
          Workspora — Business Management Simplified
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <img
            src="/workspora-author.png"
            alt="Saud Arshad Khan - Workspora Author"
            className="h-full w-full rounded-xl object-cover"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-extrabold text-emerald-600">
            Digital Transformation Platform
          </p>

          <h2 className="mt-3 text-2xl font-extrabold text-slate-950">
            Workspora brings business operations into one smart workspace.
          </h2>

          <p className="mt-5 text-sm leading-7 text-slate-700">
            Workspora is built to simplify day-to-day business management by
            connecting key operational modules such as KPIs, invoices,
            contracts, bookings, purchase orders and workflows into one clean
            digital platform.
          </p>

          <p className="mt-4 text-sm leading-7 text-slate-700">
            It helps teams move away from fragmented spreadsheets and manual
            tracking toward a structured, transparent and data-driven operating
            model. The goal is simple: improve visibility, reduce operational
            friction and support faster decisions.
          </p>

          <p className="mt-4 text-sm leading-7 text-slate-700">
            Through digital transformation, Workspora adds value by improving
            control, accountability, reporting and execution across business
            functions.
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-extrabold text-slate-950">Suggestions</h2>

        <p className="mt-4 text-sm leading-7 text-slate-700">
          Your ideas and suggestions are welcome to improve Workspora further.
          Please share feedback, enhancement ideas or feature recommendations
          with the author.
        </p>

        <div className="mt-5 inline-flex rounded-xl bg-emerald-50 px-5 py-3 text-sm font-extrabold text-emerald-700">
          soudkhan82@gmail.com , WhatsApp 0092-317-4364189
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-extrabold text-slate-950">About Author</h2>

        <p className="mt-4 text-sm leading-7 text-slate-700">
          Saud Arshad Khan is a Business Intelligence and digital transformation
          professional with a strong blend of analytics, geospatial
          intelligence, telecom operations and database-driven application
          development.
        </p>

        <p className="mt-4 text-sm leading-7 text-slate-700">
          His expertise includes Power BI, advanced dashboards, SQL, PostgreSQL,
          QGIS, ReactJS, Mapbox and Leaflet-based GIS applications. He focuses
          on converting complex operational data into clear, decision-ready
          insights.
        </p>

        <p className="mt-4 text-sm leading-7 text-slate-700">
          With extensive experience across telecom, PMO, business intelligence
          and digital operations , he has worked on network improvement,
          management dashboards, KPI tracking, analytics platforms and
          enterprise transformation initiatives. He hold data science
          certification from MIT (USA) and a bachelor in Computer Engineering
          from NUST
        </p>
      </div>
    </div>
  );
}
