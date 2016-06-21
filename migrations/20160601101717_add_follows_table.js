
exports.up = function(knex, Promise) {
  return knex.schema.createTable('users_users', (tbl) => {
    tbl.integer('user_id').references('users.id');
    tbl.integer('follower_id').references('users.id');
    tbl.unique(['user_id', 'follower_id']);
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('users_users');
};
