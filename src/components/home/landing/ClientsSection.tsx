import Image from "next/image";
import clients from "../../../../public/images/SDP n News/Clients.jpg";

export default function ClientsSection() {
  return (
    <section className="bg-void py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-start">
          <div>
            <p className="eyebrow text-signal">Trusted by</p>
            <h2 className="mt-5 text-3xl font-light leading-tight text-bone sm:text-4xl">
              Builders, schools and government
              <span className="block text-signal">delivering to Artea standards.</span>
            </h2>
          </div>
          <Image
            src={clients}
            alt="Logos of Artea Green Ventures clients including Transport for NSW, John Holland, Lipman, Trinity Grammar School, Frasers Property and Heidelberg Materials"
            className="w-full opacity-90"
          />
        </div>
      </div>
    </section>
  );
}
