import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const ADMIN_EMAIL = "o.karakopru@gmail.com";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },

  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "o.karakopru@gmail.com"
        }
      },
      async authorize(credentials) {
        if (credentials?.email === ADMIN_EMAIL) {
          return {
            id: "admin",
            email: ADMIN_EMAIL
          };
        }
        return null;
      }
    })
  ]
};
