The implementation of the different game scorings and helpers should be done on a plugin basis.
This should allow the user to upload new plugins (and therefore games) to the server while it is running.
The API should allow for a similar/the same experience as the current system and all games must still be registered to the database.
Partial games must also be saved by the server to avoid data loss on browser crashes.
All changes must be either backwards compatible or migrating to the current data in the database.

Expose a full plugin API description for the plugins on /plugins/api. In the final integrated system(production environment), this path will be public while all others will be protected by authelia. Do not handle this protection yourself.
