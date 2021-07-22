import createModule from '..';

export type UserInfo = {
  userID: string;
  userName: string;
};
export type UserState = {
  userinfo: UserInfo;
  token: string;
};

const useUserStore = createModule({
  namespace: 'user',
  state: {
    userinfo: {} as UserInfo,
    token: ''
  },
  SET_USER(payload: UserInfo) {
    console.log(this.state.userinfo);
    this.setState({ userinfo: payload });
    console.log(this.state.userinfo);
  },
  SET_TOKEN(token: string) {
    this.setState({ token });
  },
  logout(search: string) {
    this.SET_USER({} as UserInfo);
    this.SET_TOKEN('');
    window.location.href = `/login?redirect=${search}`;
  }
});
export default useUserStore;
