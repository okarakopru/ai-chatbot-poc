import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";

const ADMIN_EMAIL = "o.karakopru@gmail.com";

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD
        }
      },
      from: process.env.EMAIL_FROM
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return user.email === ADMIN_EMAIL;
    }
  }
};
