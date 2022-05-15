interface User {
    id: string;
    name: string;
    email: string;
}
  
type AuthListener = (user: User | null) => {};
type Token = string | null;

export { User, AuthListener, Token };