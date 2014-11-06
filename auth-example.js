//Auth Example, Sagar.
Appbase.credentials('sagar');

var savedCreds = Appbase.getAuth();

var main = function() {
  if(savedCreds) {
    afterAuth(savedCreds.authObj, savedCreds.requestObj);
  } else {
    showLoginButton();
  }
}

var showLoginButton = function() {
  document.getElementById("login_userInfo").style.display = 'none';
  document.getElementById("login_button").style.display = 'block';
}

var showUserInfo = function(userProfile) {
  document.getElementById("login_button").style.display = 'none';
  document.getElementById("login_userInfo").getElementsByTagName("img")[0].src = 'http://graph.facebook.com/' + userProfile.uid + '/picture';
  document.getElementById("login_userInfo").getElementsByTagName("span")[0].innerHTML = userProfile.name;
  document.getElementById("login_userInfo").style.display = 'block';
}


var login = function() {
  Appbase.authPopup('facebook', { authorize: { scope: ['user_friends'] } }, function(error, a, r) {
    if(error) throw error;
    afterAuth(a, r);
  });
}

var logout = function() {
  Appbase.unauth();
  showLoginButton();
}

var afterAuth = function(authObj, requestObj) {
  console.log(authObj);
  showUserInfo(authObj);
  fetchFriends(requestObj);
}

var fetchFriends = function(requestObj, done) {
  requestObj.get('/me/friends').done(console.log.bind(console)).fail(console.log.bind(console));
}

main();