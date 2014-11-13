//Auth Example, Sagar.
Appbase.credentials('sagar');

//see if the user is already authenticated
var savedCreds = Appbase.getAuth();

//main function to execute
var main = function() {
  if(savedCreds) {
    afterAuth(savedCreds.authObj, savedCreds.requestObj);
  } else {
    showLoginButton();
  }
}

//hides other elements and shows only the login button
var showLoginButton = function() {
  document.getElementById("login_userInfo").style.display = 'none';
  document.getElementById("login_button").style.display = 'block';
}

//hides login button and shows user info
var showUserInfo = function(userProfile) {
  document.getElementById("login_button").style.display = 'none';
  document.getElementById("login_userInfo").getElementsByTagName("img")[0].src = userProfile.avatar;
  document.getElementById("login_userInfo").getElementsByTagName("span")[0].innerHTML = userProfile.name;
  document.getElementById("login_userInfo").style.display = 'block';
}

//opens a popup for logging in
var login = function() {
  // scopes required for listing Google contacts is here: https://developers.google.com/+/api/latest/people/list
  Appbase.authPopup('google', { authorize: { scope: ['openid profile email https://www.google.com/m8/feeds https://www.googleapis.com/auth/plus.login'] } }, function(error, a, r) {
    if(error) throw error;
    afterAuth(a, r);
  });
}

//logs the user out
var logout = function() {
  Appbase.unauth();
  showLoginButton();
}

//called after the authentication is completed
var afterAuth = function(authObj, requestObj) {
  showUserInfo(authObj);
  listExistingPeople(authObj);
  fetchPeopleFromGoogle(authObj, requestObj);
}

// adds a person in to the view
var addPersonToView = function(person, feed) {
  var li = document.createElement("li");
  var img = document.createElement("img");
  var span = document.createElement("span");
  span.innerHTML = person.displayName;
  img.src = person.image.url;
  img.style = "width: 50px; height: 50px";
  li.appendChild(img);
  li.appendChild(span);
  li.id = person.id + feed;
  document.getElementById(feed).appendChild(li);
}

// removes a person from the view
var removePersonFromView = function(person, feed) {
  var li = document.getElementById(person.id + feed);
  li.parentNode.removeChild(element);
}

// list ecisting contacts of the user in appbase
var listExistingPeople = function(authObj) {
  Appbase.ns('user').v(authObj.uid).on('edge_added', function(error, eRef, eSnap) {
    if(error) throw error;
    eRef.once('properties', function(e, vRef, vSnap) {
      if(error) throw error;
      addPersonToView(vSnap.properties(), 'existing');
    })
  })
}

// using requestObj provided by appbase authentication methods, fetches people in Google plus circles
var fetchPeopleFromGoogle = function(authObj, requestObj) {
  var fetch = function(pageToken) {
    // the Google api to list people is here: https://developers.google.com/+/api/latest/people/list
    var requestURL = 'plus/v1/people/me/people/visible' + (pageToken? ('?pageToken=' + pageToken) : '');
    requestObj.get(requestURL)
      .done(function(response) {
        response.items.forEach(addToContactsIfNew.bind(null, authObj));
        if(response.nextPageToken) {
          fetch(response.nextPageToken);
        } else {
          removeNonExisting(authObj);
        }
      })
      .fail(console.log.bind(console));
  }
  fetch();
}

var allPeopleInGoogle = {};

// if a person in circles in not present in Appbase as a contact, it adds the person
var addToContactsIfNew = function(authObj, person) {
  allPeopleInGoogle[person.id] = person;
  var userRef = Appbase.ns('user').v(authObj.uid);
  userRef.outVertex(person.id).isValid(function(error, bool) {
    if(error) throw error;
    if(bool) { //the contact already exists
    } else {
      var newContactRef = Appbase.ns('user').v(person.id);
      newContactRef.setData(person, function(error, vRef) {
        if(error) throw error;
        userRef.setEdge(person.id, newContactRef, function(error) {
          if(error) throw error;
          addPersonToView(person, 'new');
        });
      })
    }
  })
}

// removes contacts from Appbase when a person is not present in circles anymore
var removeNonExisting = function(authObj) {
  var userRef = Appbase.ns('user').v(authObj.uid);
  userRef.on('edge_added', function(error, eRef, eSnap) {
    if(error) throw error;
    if(! allPeopleInGoogle[eSnap.name()]) {
      eRef.once('properties', function(error, vRef, vSnap) {
        if(error) throw error;
        userRef.removeEdge(eSnap.name());
        addPersonToView(vSnap.properties(), 'removed');
        removePersonFromView(vSnap.properties(), 'existing');
      })
    }
  })
}

//call main
main();