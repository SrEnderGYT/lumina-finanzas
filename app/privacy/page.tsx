import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Política de privacidad | Lúmina",
  description: "Cómo Lúmina protege y utiliza los datos necesarios para organizar tus movimientos financieros.",
};

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#f4f7f6] px-5 py-10 text-[#10231e] sm:px-8 sm:py-16">
    <article className="mx-auto max-w-3xl rounded-[28px] border border-[#dce5e2] bg-white p-6 shadow-[0_20px_70px_rgba(16,40,32,.08)] sm:p-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#39705e]"><ArrowLeft className="size-4"/>Volver a Lúmina</Link>
      <div className="mt-10 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#102820] text-[#c9ff4d]"><LockKeyhole className="size-6"/></span><div><p className="section-label">Privacidad</p><h1 className="mt-1 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Tus datos siguen siendo tuyos.</h1></div></div>
      <p className="mt-8 text-sm text-[#75837e]">Última actualización: 24 de septiembre de 2026</p>
      <div className="mt-8 space-y-8 leading-7 text-[#52645e]">
        <Policy title="Qué datos utiliza Lúmina">Al autorizar Google, Lúmina solicita únicamente el alcance <code>gmail.readonly</code>. Procesa mensajes relacionados con movimientos financieros para extraer banco, comercio, fecha, monto, moneda, tipo de operación y los últimos cuatro dígitos de una tarjeta cuando estén presentes.</Policy>
        <Policy title="Qué almacenamos">Guardamos los movimientos normalizados, categorías, reglas, tarjetas enmascaradas y el identificador técnico del mensaje necesario para evitar duplicados. Nunca solicitamos ni almacenamos números completos de tarjeta, CVV o contraseñas de Gmail.</Policy>
        <Policy title="Cómo protegemos la información">Los tokens de Google se cifran antes de persistirse. Las sesiones se protegen con cookies HTTP-only y cada consulta del servidor restringe el acceso al propietario de los datos.</Policy>
        <Policy title="Uso y transferencia">Los datos de Gmail se usan exclusivamente para ofrecer las funciones financieras visibles de Lúmina. No se venden ni se utilizan para publicidad. El análisis mediante IA es opcional y solo se activa cuando el administrador configura expresamente ese mecanismo secundario.</Policy>
        <Policy title="Control y revocación">Puedes corregir o eliminar movimientos desde la aplicación y revocar el acceso de Lúmina en cualquier momento desde la seguridad de tu Cuenta de Google. Al revocar el acceso, Lúmina deja de poder sincronizar mensajes nuevos.</Policy>
        <Policy title="Conservación">Los datos permanecen asociados a tu cuenta mientras utilices el servicio. Los movimientos eliminados dejan de mostrarse y no vuelven a importarse accidentalmente mediante el mismo identificador de Gmail.</Policy>
      </div>
      <div className="mt-10 flex gap-3 rounded-2xl bg-[#edf6f2] p-4 text-sm text-[#315548]"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#1b986c]"/><p>El código fuente y el canal para reportar problemas están disponibles en <a className="font-semibold underline" href="https://github.com/SrEnderGYT/lumina-finanzas">GitHub</a>.</p></div>
    </article>
  </main>;
}

function Policy({title,children}:{title:string;children:React.ReactNode}) {
  return <section><h2 className="text-xl font-semibold tracking-[-.03em] text-[#173d32]">{title}</h2><p className="mt-2">{children}</p></section>;
}
