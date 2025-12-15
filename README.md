<p align="center">
  <img height="150" src="https://github.com/lafranceinsoumise/actionpopulaire.fr/blob/staging/agir/front/components/genericComponents/logos/action-populaire.svg">
</p>

![Tests status](https://github.com/lafranceinsoumise/actionpopulaire.fr/actions/workflows/run-tests.yml/badge.svg)

# actionpopulaire.fr

## Mise en place du projet

### Pré-requis
* Python >= 3.10
* Poetry >= 2.X
* Docker
* Lando >= 3.X

### Installation

```bash
git clone https://github.com/lafranceinsoumise/actionpopulaire.fr
cd actionpopulaire.fr

# Création d'un fichier de variables d'environnement
cp .env.dev .env
cat .lando.env >> .env

lando start
lando manage migrate 
lando manage update_data_france

# Faire un super user pour la partie admin
# garder bien de côté vos identifiants
lando manage createsuperperson

# peupler la base de données
lando manage shell < agir/api/fixtures/populate.py 
```
Une fois le compte crée, vous connectez via l'interface admin http://ap.lfi.site/admin
Dans le même temps, vous serez connecté à action populaire : http://ap.lfi.site/

Chaque mail émis par le système est capturé par mailhog, que vous pouvez consulter via : http://mailhog.ap.lfi.site/

*Une fois la `superperson` créé*, vous pouvez peupler la base de données, vous serez ajouter en tant qu'animateur·ice
à un groupe d'action certifié, ainsi, qu'à une boucle départementale.

Autre compte disponible pour développer :
```
membre@lfi.fr - membre de votre GA
```

### Contribuer au projet

Pour contribuer au projet suivre [ce document](https://github.com/lafranceinsoumise/actionpopulaire.fr/blob/staging/CONTRIBUTING.md)

## Commandes utiles

### Base de données
À chaque changement de vos models, vous devez générer et appliquer les migrations de vos tables.

```bash
lando manage makemigrations your_app
lando manage migrate 
```

### Debugging

#### Logs

`lando logs --service=django -f`

Remplacer django par le service concerné : celery|webpack|redis|database

#### Django Toolbar
Vous pouvez activer la toolbar de Django, qui vous permet de suivre les requêtes SQL, HTTP, les signaux, le cache, etc.
directement depuis l'interface web.  
1. Dans `.env` mettre `ENABLE_DEBUG_TOOLBAR=true`
2. Redemarrer Django `docker restart ap_django_1`

![Django toolbar](https://github.com/lafranceinsoumise/actionpopulaire.fr/blob/staging/.docs/images/toolbar.png "Toolbar")

### Tests

```bash
$ black agir/
$ node_modules/.bin/eslint --fix agir/
$ poetry run ./manage.py test
``` 

# Mise à jour suite au squashing des migrations du 7 janvier 2021

Si vous avez un environnement de développement déjà en place avant le 7 janvier,
vous devez réaliser les opérations suivantes pour qu'il reste fonctionnel.

Assurez-vous de d'abord réaliser toutes les migrations jusqu'au commit c5e16d4be173.
Ensuite, dans une console django, exécutez le script suivant :

```python
from django.db import connection

QUERY = """
INSERT INTO django_migrations (app, name, applied)
VALUES 
('people', '0001_creer_modeles', NOW()),
('people', '0002_objets_initiaux', NOW()),
('people', '0003_segments', NOW()),
('payments', '0001_creer_modeles', NOW()),
('groups', '0001_creer_modeles', NOW()),
('groups', '0002_creer_sous_types', NOW()),
('events', '0001_creer_modeles', NOW()),
('events', '0002_objets_initiaux_et_recherche', NOW());
"""

with connection.cursor() as cursor:
    cursor.execute(QUERY)
```

Les nouvelles migrations seront ainsi considérées comme déjà exécutées.

[django-server]: http://agir.local:8000/
[mailhog]: http://agir.local:8025/
[django-admin]: http://agir.local:8000/admin/
