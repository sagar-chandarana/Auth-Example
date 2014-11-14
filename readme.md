# Authentication with Appbase

Appbase allows developers to integrate with 3rd party authentication providers easily. Not only that, Appbase's JS lib can also call the provider's api to and fetch user's data, like Facebook activities, Dropbox files, Google's contacts etc.

In this example, we are trying to build a contact list stored in Appbase, which automatically syncs with the people in a user's Google Plus circles. We are using Appbase's authentication services to login the user with Google credentials, and then retrive the people in user's circles.

## Setting up authentication with Google

It mostly requires a developer to create an application in Google and then enter the app key-secret in Appbase's developer console. Find out [here](http://docs.appbase.io/docs/authentications.html) how to do that, and it also explains the basics of Appbase's Auth service.

## How are we pulling this off

Three simple steps:

1. Get the user logged in with Google.
2. Fetch all the people in user's Google Plus circles, store them in Appbase as the user's contacts, if they are not already added.
3. Check if a contact in stored in Appbase is still in the user's circles, if not, remove it from Appbase.

## Logging in and out
```js
Appbase.authPopup('google', { authorize: { scope: ['openid profile email https://www.google.com/m8/feeds https://www.googleapis.com/auth/plus.login'] } }, function(error, authObj, requestObj) {
    if(error) throw error;
    afterAuth(authObj, requestObj);
  });
```

`Appbase.authPopup()` opens a popup with the Google's login page. When the user successfully logs in, the callback is called with `authObj` and `requestObj`. With these objects, its very easy to get the user information, and call provider's data apis.

```js
var showUserInfo = function(authObj) {
  document.getElementById("login_button").style.display = 'none';
  document.getElementById("login_userInfo").getElementsByTagName("img")[0].src = authObj.avatar;
  document.getElementById("login_userInfo").getElementsByTagName("span")[0].innerHTML = authObj.name;
  document.getElementById("login_userInfo").style.display = 'block';
}
```
The above method uses `authObj` to display user's name and thumbnail url. You can find out more about `authObj` and `requestObj` [here](http://docs.appbase.io/docs/authentications.html).

Notice that we have set the permission scope as __'openid profile email https://www.google.com/m8/feeds https://www.googleapis.com/auth/plus.login'__. According to [Google's apis](https://developers.google.com/+/api/latest/people/list), this allows us to access the people in user' circles.

Once logged in, the credentials are cached locally and with `Appbase.getAuth()`, they can be retrieved across browser restarts. This way we dont have to propmt the user again for logging in even when the browser is restarted.


`Appbase.unauth()` removes the credentials from cache and logs the user out.

## Syncing
```js
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
```

This code here uses `requestObj` to interact with Google' _people endpoint (plus/v1/people/me/people/visible)_. Google only provides maximum 100 results in a request, so we are using the pagination support and calling the endpoint repetitively until there is no `nextPageToken` in the reponse. To know how this endpoint works, checkout [Google's documentation](https://developers.google.com/+/api/latest/people/list).

#### Adding new people as contacts
```js
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
```

A contact is stord as _edges_ in Appbase. Each contact is an edge from the authenticated user's vertex, to the user who is added as a contact. The name of the edge is contact's google user id. We are first checking with `isValid()` is the edge already exists, meaning a person is already added as a contact. If not, we store the person's data with `setData(person)` and create a new edge with `setEdge(person.id)`.

#### Listing existing contacts
```js
var listExistingPeople = function(authObj) {
  Appbase.ns('user').v(authObj.uid).on('edge_added', function(error, eRef, eSnap) {
    if(error) throw error;
    eRef.once('properties', function(e, vRef, vSnap) {
      if(error) throw error;
      addPersonToView(vSnap.properties(), 'existing');
    })
  })
}
```

With *edge_added* event, we listen to all the edges in the vertex. As contacts are added as edges, we get the contacts when we listen to this event. `eRef` points the vertex, where the contacts data (name, thumbnail url etc) is stored as properties. By litening `once()` on properties, we get this data and add it into the view.

#### Removing contacts
```js
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
```

It may happen that the user removes some people from his circles. We have to remove those people from our contact list as well. Here, `allPeopleInGoogle` is dictionary were all the current people in circles are stored, with their userids as the keys. As we have stored contacts in edges with edgenames as the person's userid. So we check if an edgename is a part of `allPeopleInGoogle`, if not, we remove the edge, and thus the contact by calling `removeEdge(edgeName)`.