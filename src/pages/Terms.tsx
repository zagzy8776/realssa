import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";

const termsContent = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using the EntertainmentGHC website (the \"Site\"), you agree to be bound by these Terms of Service (\"Terms\") and all applicable laws and regulations. If you do not agree with these Terms, you are prohibited from using or accessing this Site.",
  },
  {
    title: "2. Use of the Site",
    content: "You agree to use the Site only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the Site. Prohibited behavior includes harassing or causing distress or inconvenience to any other user, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within the Site.",
  },
  {
    title: "3. Intellectual Property",
    content: "The content, organization, graphics, design, compilation, magnetic translation, digital conversion, and other matters related to the Site are protected under applicable copyrights, trademarks, and other proprietary (including but not limited to intellectual property) rights. The copying, redistribution, use, or publication by you of any such content or any part of the Site is prohibited, except as expressly permitted by these Terms.",
  },
  {
    title: "4. User Content",
    content: "By submitting content to the Site (including but not limited to comments, articles, photos, or videos), you grant EntertainmentGHC a worldwide, royalty-free, perpetual, irrevocable, non-exclusive, transferable, and sublicensable right and license to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, perform, and display such content (in whole or in part) worldwide and/or to incorporate it in other works in any form, media, or technology now known or later developed.",
  },
  {
    title: "5. Disclaimer of Warranties",
    content: "The Site is provided on an \"as is\" and \"as available\" basis. EntertainmentGHC makes no representations or warranties of any kind, express or implied, as to the operation of the Site or the information, content, materials, or products included on this Site.",
  },
  {
    title: "6. Limitation of Liability",
    content: "In no event shall EntertainmentGHC, its affiliates, or their respective directors, employees, agents, or representatives be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the Site.",
  },
  {
    title: "7. Indemnification",
    content: "You agree to indemnify, defend, and hold harmless EntertainmentGHC, its affiliates, and their respective directors, officers, employees, agents, and representatives from and against any and all claims, liabilities, damages, losses, costs, expenses, or fees arising out of or relating to your use of the Site.",
  },
  {
    title: "8. Third-Party Links",
    content: "The Site may contain links to third-party websites that are not owned or controlled by EntertainmentGHC. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites.",
  },
  {
    title: "9. Termination",
    content: "We may terminate or suspend your access to the Site immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms.",
  },
  {
    title: "10. Governing Law",
    content: "These Terms shall be governed by and construed in accordance with the laws of Ghana, without regard to its conflict of law provisions.",
  },
  {
    title: "11. Changes to Terms",
    content: "We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect.",
  },
  {
    title: "12. Contact Us",
    content: "If you have any questions about these Terms, please contact us at legal@entertainmentghc.com.",
  },
];

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Page Header */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 text-foreground">
            Terms of Service
          </h1>
          <div className="w-24 h-1 bg-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Last updated: January 24, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-8">
            {termsContent.map((section) => (
              <article key={section.title}>
                <h2 className="text-xl md:text-2xl font-display font-bold mb-3 text-foreground">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              </article>
            ))}

            <article>
              <address className="not-italic text-muted-foreground mt-6">
                EntertainmentGHC<br />
                Attn: Legal Department<br />
                No. 12 Liberation Road<br />
                Accra, Greater Accra Region<br />
                Ghana
              </address>
            </article>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Terms;
